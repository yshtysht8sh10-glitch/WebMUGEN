import { getCurrentAnimationElement, type CurrentAnimationElement } from '../../core/animation/AnimationPlayer';
import type { GameState } from '../../core/engine/types';
import type { ExplodRuntimeEntry } from '../../core/explod/ExplodSystem';
import type { AirDocument } from '../../parser/air/AirTypes';
import type { ImageDataSpritePack } from '../../core/sprite/ImageDataSpriteTypes';
import type { SpritePack } from '../../core/sprite/SpriteTypes';

export type CharacterRenderAssets = {
  airDocument?: AirDocument;
  spritePack?: SpritePack | null;
  imageDataSpritePack?: ImageDataSpritePack | null;
};

export type ExplodRenderFrame = {
  entry: ExplodRuntimeEntry;
  currentElement: CurrentAnimationElement;
  assets: CharacterRenderAssets;
  screenX: number;
  screenY: number;
  supplementalTile?: boolean;
};

export type ExplodRenderResolution = {
  frames: ExplodRenderFrame[];
  diagnosticLines: string[];
};

export function resolveExplodRenderFrames(
  state: GameState,
  defaultAssets: CharacterRenderAssets,
  ownerAssets: Partial<Record<1 | 2, CharacterRenderAssets>> = {},
  fightFxAssets?: CharacterRenderAssets,
  cameraX = 0,
  cameraY = 0,
  diagnosticsEnabled = true,
): ExplodRenderResolution {
  const frames: ExplodRenderFrame[] = [];
  const diagnosticLines: string[] = [];

  for (const entry of state.explods.entries) {
    const assets = entry.animationSource === 'fightfx'
      ? fightFxAssets
      : ownerAssets[entry.owner.rootPlayerId] ?? defaultAssets;
    const currentElement = assets?.airDocument
      ? getCurrentAnimationElement(assets.airDocument, entry.animNo, entry.animTime)
      : null;

    if (!assets || !currentElement) {
      if (diagnosticsEnabled) {
        diagnosticLines.push(
          `raw.explod_render internalId=${entry.runtimeId} mugenId=${entry.mugenId} anim=${entry.animationSource === 'fightfx' ? 'F' : ''}${entry.animNo} result=hidden reason=animation_not_found`,
        );
      }
      continue;
    }

    const screenX = entry.coordinateSpace === 'stage' ? entry.position.x - cameraX : entry.position.x;
    const screenY = entry.coordinateSpace === 'stage' ? entry.position.y - cameraY : entry.position.y;
    frames.push({ entry, currentElement, assets, screenX, screenY });
    if (diagnosticsEnabled) {
      diagnosticLines.push(
        `raw.explod_render internalId=${entry.runtimeId} mugenId=${entry.mugenId} anim=${entry.animationSource === 'fightfx' ? 'F' : ''}${entry.animNo} elem=${currentElement.elementIndex + 1} world=(${entry.position.x},${entry.position.y}) screen=(${screenX},${screenY}) facing=${entry.facing} vfacing=${entry.verticalFacing} result=resolved`,
      );
    }
  }

  return { frames, diagnosticLines };
}

export function getExplodsInDrawOrder(frames: readonly ExplodRenderFrame[]): ExplodRenderFrame[] {
  return [...frames].sort((a, b) =>
    Number(a.entry.onTop) - Number(b.entry.onTop)
    || a.entry.spritePriority - b.entry.spritePriority
    // WinMUGEN places the earlier-created Explod in front when priorities tie.
    // Canvas draws back-to-front, so newer runtime IDs must be emitted first.
    || b.entry.runtimeId - a.entry.runtimeId,
  );
}

export function completeExtendedViewportExplodTiles(
  frames: readonly ExplodRenderFrame[],
  viewportWidth: number,
  winMugenWidth = 320,
): ExplodRenderFrame[] {
  if (viewportWidth <= winMugenWidth) return [...frames];

  const completed = [...frames];
  const groups = new Map<string, ExplodRenderFrame[]>();
  for (const frame of frames) {
    const entry = frame.entry;
    const element = frame.currentElement.element;
    const groupKey = [
      entry.owner.entityId, entry.animNo, entry.animTime, frame.currentElement.elementIndex,
      frame.screenY, entry.facing, entry.verticalFacing, entry.spritePriority, Number(entry.onTop),
      entry.render.scaleX, entry.render.scaleY, element.groupNo, element.imageNo,
    ].join(':');
    const group = groups.get(groupKey) ?? [];
    group.push(frame);
    groups.set(groupKey, group);
  }

  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => a.screenX - b.screenX);
    const positions = [...new Set(ordered.map((frame) => frame.screenX))];
    if (positions.length < 3) continue;
    const spacing = positions[1] - positions[0];
    if (!(spacing > 0) || positions.slice(2).some((position, index) => Math.abs(position - positions[index + 1] - spacing) > 0.01)) continue;

    const sample = ordered[0];
    const element = sample.currentElement.element;
    const spriteId = `${element.groupNo},${element.imageNo}` as `${number},${number}`;
    const imageDataWidth = sample.assets.imageDataSpritePack?.sprites.get(spriteId)?.imageData.width;
    const bitmapWidth = sample.assets.spritePack?.sprites.get(spriteId)?.image.naturalWidth;
    const spriteWidth = (imageDataWidth ?? bitmapWidth ?? 0) * Math.abs(sample.entry.render.scaleX);
    if (!(spriteWidth > 0) || spacing < spriteWidth * 0.8 || spacing > spriteWidth * 1.2) continue;

    let left = ordered[0];
    while (left.screenX - spacing / 2 > 0) {
      left = { ...left, screenX: left.screenX - spacing, supplementalTile: true };
      completed.push(left);
    }
    let right = ordered[ordered.length - 1];
    while (right.screenX + spacing / 2 < viewportWidth) {
      right = { ...right, screenX: right.screenX + spacing, supplementalTile: true };
      completed.push(right);
    }
  }

  return completed;
}
