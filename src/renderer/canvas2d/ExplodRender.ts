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
    || a.entry.runtimeId - b.entry.runtimeId,
  );
}
