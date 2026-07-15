import type { AirDocument } from '../../parser/air/AirTypes';
import { getCurrentAnimationElement } from '../../core/animation/AnimationPlayer';
import {
  getPlayerAttackBoxes,
  getPlayerBodyBoxes,
} from '../../core/collision/CollisionResolver';
import type { GameState, PlayerState, ProjectileState, Rect } from '../../core/engine/types';
import { getAttackBox, getBodyBox, isAttackActive } from '../../core/engine/SimpleCollision';
import { getProjectileWorldBox } from '../../core/projectile/ProjectileSystem';
import { buildPushBox } from '../../core/engine/FallbackStageRules';
import { findSprite, spriteKey } from '../../core/sprite/SpritePackLoader';
import type { SpritePack } from '../../core/sprite/SpriteTypes';
import type { ImageDataSpritePack } from '../../core/sprite/ImageDataSpriteTypes';
import { getPlayerPowerRatio } from '../../core/power/PowerGauge';
import { ImageDataSpriteRenderer } from './ImageDataSpriteRenderer';
import { getScreenShakeOffset, type HitFeedbackState } from '../../core/engine/HitFeedback';
import { HitFeedbackRenderer } from './HitFeedbackRenderer';
import type { RoundState } from '../../core/engine/RoundState';
import type { RoundScore } from '../../core/engine/RoundScore';
import { RoundStateRenderer } from './RoundStateRenderer';
import {
  getExplodsInDrawOrder,
  resolveExplodRenderFrames,
  type CharacterRenderAssets,
  type ExplodRenderFrame,
} from './ExplodRender';

export class CanvasRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly imageDataSpriteRenderer = new ImageDataSpriteRenderer();
  private readonly hitFeedbackRenderer = new HitFeedbackRenderer();
  private readonly roundStateRenderer = new RoundStateRenderer();
  private lastPowerHudSignature = '';
  private reportedInitialPower = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly airDocument?: AirDocument,
    private readonly spritePack?: SpritePack | null,
    private readonly imageDataSpritePack?: ImageDataSpritePack | null,
    private readonly ownerAssets: Partial<Record<1 | 2, CharacterRenderAssets>> = {},
    private readonly fightFxAssets?: CharacterRenderAssets,
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('CanvasRenderingContext2D is not available.');
    this.context = context;
  }

  render(
    state: GameState,
    hitFeedback?: HitFeedbackState,
    roundState?: RoundState,
    roundScore?: RoundScore,
  ): string[] {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const shake = getScreenShakeOffset(hitFeedback);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    this.drawStage(ctx);
    this.drawLifeBars(ctx, state);
    const powerDiagnostics = this.drawPowerBars(ctx, state);
    if (roundState) this.roundStateRenderer.render(ctx, roundState, roundScore);
    this.drawProjectiles(ctx, state.projectiles);
    const explodResolution = resolveExplodRenderFrames(state, this.defaultAssets(), this.ownerAssets, this.fightFxAssets);
    const renderDiagnostics = [...explodResolution.diagnosticLines];
    const regularDrawables = [
      ...getPlayersInSpritePriorityOrder(state).map((player) => ({
        kind: 'player' as const,
        priority: player.sprPriority ?? 0,
        stableId: player.id,
        player,
      })),
      ...state.helpers.entries.map((helper) => ({
        kind: 'player' as const,
        priority: helper.player.sprPriority ?? 0,
        stableId: helper.entityId,
        player: helper.player,
      })),
      ...getExplodsInDrawOrder(explodResolution.frames)
        .filter((frame) => !frame.entry.onTop)
        .map((frame) => ({
          kind: 'explod' as const,
          priority: frame.entry.spritePriority,
          stableId: frame.entry.runtimeId,
          frame,
        })),
    ].sort((a, b) => a.priority - b.priority || Number(a.kind === 'explod') - Number(b.kind === 'explod') || a.stableId - b.stableId);
    for (const drawable of regularDrawables) {
      if (drawable.kind === 'player') renderDiagnostics.push(this.drawPlayer(ctx, drawable.player, drawable.player.id === 1 ? '#66ccff' : '#ff99aa'));
      else renderDiagnostics.push(this.drawExplod(ctx, drawable.frame));
    }
    if (hitFeedback) this.hitFeedbackRenderer.render(ctx, hitFeedback);
    for (const frame of getExplodsInDrawOrder(explodResolution.frames).filter((candidate) => candidate.entry.onTop)) {
      renderDiagnostics.push(this.drawExplod(ctx, frame));
    }
    this.drawDebugBoxes(ctx, state.players[0]);
    this.drawDebugBoxes(ctx, state.players[1]);
    state.helpers.entries.forEach((helper) => this.drawDebugBoxes(ctx, helper.player));
    this.drawProjectileDebugBoxes(ctx, state.projectiles);
    ctx.restore();
    return [...powerDiagnostics, ...renderDiagnostics];
  }

  private defaultAssets(): CharacterRenderAssets {
    return {
      airDocument: this.airDocument,
      spritePack: this.spritePack,
      imageDataSpritePack: this.imageDataSpritePack,
    };
  }

  private drawStage(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#26351e';
    ctx.fillRect(0, 285, this.canvas.width, 80);
  }

  private drawLifeBars(ctx: CanvasRenderingContext2D, state: GameState): void {
    const [p1, p2] = state.players;
    ctx.fillStyle = '#111827';
    ctx.fillRect(20, 18, 260, 16);
    ctx.fillRect(360, 18, 260, 16);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(20, 18, 260 * (p1.life / 1000), 16);
    ctx.fillRect(620 - 260 * (p2.life / 1000), 18, 260 * (p2.life / 1000), 16);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(20, 18, 260, 16);
    ctx.strokeRect(360, 18, 260, 16);
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: ProjectileState[]): void {
    for (const projectile of projectiles) {
      const currentElement = this.airDocument
        ? getCurrentAnimationElement(this.airDocument, projectile.animNo, projectile.animTime)
        : null;

      if (currentElement) {
        const drawn = this.drawSpriteByElement(
          ctx,
          currentElement.element.groupNo,
          currentElement.element.imageNo,
          projectile.x,
          projectile.y,
          projectile.facing,
          currentElement.element.offsetX,
          currentElement.element.offsetY,
          currentElement.element.flip,
        );

        if (drawn.drawn) continue;
      }

      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      ctx.scale(projectile.facing, 1);
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(0, 0, 13 + Math.sin(projectile.animTime / 2) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#bfdbfe';
      ctx.beginPath();
      ctx.arc(-4, -4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerState, color: string): string {
    const hasOwnerAssetMap = Object.keys(this.ownerAssets).length > 0;
    const assets = this.ownerAssets[player.id] ?? (hasOwnerAssetMap ? undefined : this.defaultAssets());
    const stateOwner = player.stateOwnerId ?? player.id;
    const prefix = `raw.render entity=p${player.id} state=${player.stateNo} anim=${player.animNo} stateOwner=${stateOwner} animOwner=${player.id}`;
    if (!assets) return `${prefix} result=skip reason=animation_owner_missing playerVisible=0 rendererDrawRequested=0`;

    const assertSpecial = ((player as PlayerState & { runtime?: { assertSpecial?: string[] } }).runtime?.assertSpecial ?? [])
      .map((flag) => flag.trim().toLowerCase());
    if (assertSpecial.includes('invisible')) {
      return `${prefix} result=skip reason=entity_invisible playerVisible=0 assertSpecialInvisible=1 rendererDrawRequested=0`;
    }

    if (!assets.airDocument && (assets.imageDataSpritePack || assets.spritePack)) {
      return `${prefix} result=skip reason=animation_owner_missing animExists=0 playerVisible=0 rendererDrawRequested=0`;
    }

    const action = assets.airDocument?.actions.find((candidate) => candidate.actionNo === player.animNo);
    if (assets.airDocument && !action) {
      return `${prefix} result=skip reason=air_action_missing animExists=0 playerVisible=0 rendererDrawRequested=0`;
    }
    const currentElement = assets.airDocument
      ? getCurrentAnimationElement(assets.airDocument, player.animNo, player.animTime)
      : null;

    if (action && !currentElement) {
      return `${prefix} result=skip reason=air_element_missing animExists=1 playerVisible=0 rendererDrawRequested=0`;
    }

    if (currentElement) {
      const { groupNo, imageNo } = currentElement.element;
      const elementFields = `animExists=1 airElementIndex=${currentElement.elementIndex + 1} airElementSpriteGroup=${groupNo} airElementSpriteIndex=${imageNo}`;
      if (groupNo < 0 || imageNo < 0) {
        return `${prefix} ${elementFields} result=skip reason=intentional_invisible_element spriteExists=0 playerVisible=0 rendererDrawRequested=0`;
      }
      const drawn = this.drawSpriteByElement(
        ctx,
        groupNo,
        imageNo,
        player.x,
        player.y,
        player.facing,
        currentElement.element.offsetX,
        currentElement.element.offsetY,
        currentElement.element.flip,
        assets,
      );

      if (drawn.drawn) return `${prefix} ${elementFields} spriteExists=1 result=drawn playerVisible=1 rendererDrawRequested=1 ${drawn.diagnostic}`;
      if (assets.imageDataSpritePack || assets.spritePack) {
        return `${prefix} ${elementFields} spriteExists=0 result=skip reason=sprite_missing playerVisible=0 rendererDrawRequested=0`;
      }
    }

    this.drawFallbackPlayer(ctx, player, color, currentElement);
    return `${prefix} result=fallback reason=no_character_sprite_assets playerVisible=1 rendererDrawRequested=1 rendererDrawSource=debug_fallback`;
  }

  private drawPowerBars(ctx: CanvasRenderingContext2D, state: GameState): string[] {
    const [p1, p2] = state.players;
    const p1Ratio = getPlayerPowerRatio(p1);
    const p2Ratio = getPlayerPowerRatio(p2);
    ctx.fillStyle = '#111827';
    ctx.fillRect(20, 342, 260, 8);
    ctx.fillRect(360, 342, 260, 8);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(20, 342, 260 * p1Ratio, 8);
    ctx.fillRect(620 - 260 * p2Ratio, 342, 260 * p2Ratio, 8);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(20, 342, 260, 8);
    ctx.strokeRect(360, 342, 260, 8);

    const p1Power = p1.power ?? 0;
    const p2Power = p2.power ?? 0;
    const p1PowerMax = p1.powerMax ?? 3000;
    const p2PowerMax = p2.powerMax ?? 3000;
    const signature = `${p1Power}/${p1PowerMax}|${p2Power}/${p2PowerMax}`;
    if (signature === this.lastPowerHudSignature) return [];
    this.lastPowerHudSignature = signature;
    const diagnostics = [`raw.power_hud p1=${p1Power}/${p1PowerMax} width=${260 * p1Ratio} p2=${p2Power}/${p2PowerMax} width=${260 * p2Ratio}`];
    if (!this.reportedInitialPower) {
      this.reportedInitialPower = true;
      diagnostics.unshift(
        `raw.power entity=p1 source=initial before=0 delta=${p1Power} after=${p1Power} max=${p1PowerMax}`,
        `raw.power entity=p2 source=initial before=0 delta=${p2Power} after=${p2Power} max=${p2PowerMax}`,
      );
    }
    return diagnostics;
  }

  private drawExplod(ctx: CanvasRenderingContext2D, frame: ExplodRenderFrame): string {
    const { entry, currentElement } = frame;
    const blend = resolveExplodBlend(entry.render.transparency, entry.render.alpha);
    ctx.save();
    ctx.globalCompositeOperation = blend.compositeOperation;
    ctx.globalAlpha = blend.globalAlpha;
    const drawResult = this.drawSpriteByElement(
      ctx,
      currentElement.element.groupNo,
      currentElement.element.imageNo,
      frame.screenX,
      frame.screenY,
      entry.facing,
      currentElement.element.offsetX,
      currentElement.element.offsetY,
      currentElement.element.flip,
      frame.assets,
      entry.verticalFacing,
      entry.render.scaleX,
      entry.render.scaleY,
      entry.render.ownPalette,
    );
    ctx.restore();
    return `raw.explod_draw internalId=${entry.runtimeId} mugenId=${entry.mugenId} anim=${entry.animationSource === 'fightfx' ? 'F' : ''}${entry.animNo} elem=${currentElement.elementIndex + 1} screen=(${frame.screenX},${frame.screenY}) facing=${entry.facing} vfacing=${entry.verticalFacing} scale=(${entry.render.scaleX},${entry.render.scaleY}) trans=${entry.render.transparency ?? 'none'} alpha=(${entry.render.alpha?.source ?? 256},${entry.render.alpha?.destination ?? 0}) composite=${blend.compositeOperation} ownpal=${entry.render.ownPalette ? 1 : 0} shadow=(${entry.render.shadow.red},${entry.render.shadow.green},${entry.render.shadow.blue}) sprpriority=${entry.spritePriority} ontop=${entry.onTop ? 1 : 0} result=${drawResult.drawn ? 'drawn' : 'hidden'}${drawResult.drawn ? ` ${drawResult.diagnostic}` : ' reason=sprite_not_found'}${blend.limitation ? ` limitation=${blend.limitation}` : ''}${entry.render.ownPalette ? ' limitation_ownpal=dynamic_palette_effects_unverified' : ''}${entry.render.shadow.red || entry.render.shadow.green || entry.render.shadow.blue ? ' limitation_shadow=no_effect_shadow_pass' : ''}`;
  }

  private drawSpriteByElement(
    ctx: CanvasRenderingContext2D,
    groupNo: number,
    imageNo: number,
    x: number,
    y: number,
    facing: 1 | -1,
    offsetX = 0,
    offsetY = 0,
    flip = '',
    assets: CharacterRenderAssets = this.defaultAssets(),
    verticalFacing: 1 | -1 = 1,
    scaleX = 1,
    scaleY = 1,
    ownPalette = false,
  ): { drawn: boolean; diagnostic: string } {
    const flipX = flip.toUpperCase().includes('H');
    const key = spriteKey(groupNo, imageNo);

    const imageDataSprite = assets.imageDataSpritePack?.sprites.get(key);
    if (imageDataSprite) {
      const resolved = this.imageDataSpriteRenderer.resolveCanvas(assets.imageDataSpritePack, groupNo, imageNo, ownPalette);
      if (!resolved) return { drawn: false, diagnostic: '' };

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing * (flipX ? -1 : 1) * scaleX, verticalFacing * scaleY);
      ctx.drawImage(resolved.canvas, -imageDataSprite.xAxis + offsetX, -imageDataSprite.yAxis + offsetY);
      ctx.restore();
      return { drawn: true, diagnostic: resolved.diagnostic };
    }

    const sprite = findSprite(assets.spritePack, groupNo, imageNo);
    if (sprite) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing * (flipX ? -1 : 1) * scaleX, verticalFacing * scaleY);
      ctx.drawImage(sprite.image, -sprite.xAxis + offsetX, -sprite.yAxis + offsetY);
      ctx.restore();
      return { drawn: true, diagnostic: 'sprite=bitmap cache=external' };
    }

    return { drawn: false, diagnostic: '' };
  }

  private drawFallbackPlayer(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    color: string,
    currentElement: ReturnType<typeof getCurrentAnimationElement>,
  ): void {
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(player.x, 305, 32, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.scale(player.facing, 1);

    const isAttack = player.stateNo === 200;
    const isSpecial = player.stateNo === 1000;
    const isWalk = player.stateNo === 20;
    const bob = isWalk ? Math.sin(player.animTime / 3) * 3 : 0;
    const frameTint = currentElement ? currentElement.element.imageNo % 3 : 0;

    ctx.fillStyle = player.hitPause > 0 ? '#ffffff' : isSpecial ? '#a7f3d0' : isAttack ? '#ffcc66' : color;
    ctx.fillRect(-16, -58 + bob, 32, 58);
    ctx.fillStyle = '#ffe0bd';
    ctx.fillRect(-13, -78 + bob, 26, 22);
    ctx.fillStyle = '#222';
    ctx.fillRect(4, -71 + bob, 4, 4);

    ctx.fillStyle = frameTint === 0 ? color : frameTint === 1 ? '#c4b5fd' : '#fde68a';

    if (isSpecial && player.animTime > 6 && player.animTime < 16) {
      ctx.fillRect(14, -50 + bob, 58, 12);
    } else if (isAttack && player.animTime > 4 && player.animTime < 12) {
      ctx.fillRect(14, -48 + bob, 42, 10);
    } else {
      ctx.fillRect(14, -46 + bob, 10, 28);
    }

    if (currentElement) {
      ctx.fillStyle = '#111';
      ctx.font = '10px monospace';
      ctx.fillText(`${currentElement.element.groupNo},${currentElement.element.imageNo}`, -18, -86 + bob);
    }

    ctx.restore();
  }

  private drawDebugBoxes(ctx: CanvasRenderingContext2D, player: PlayerState): void {
    const pushBox = buildPushBox(player);
    this.strokeRect(ctx, {
      x: pushBox.left,
      y: pushBox.top,
      width: pushBox.right - pushBox.left,
      height: pushBox.bottom - pushBox.top,
    }, '#00bfff');
    ctx.fillStyle = '#00bfff';
    ctx.font = '9px monospace';
    ctx.fillText(`push ${pushBox.mode} ${pushBox.source}`, pushBox.left, pushBox.top - 2);
    if (this.airDocument) {
      getPlayerBodyBoxes(player, this.airDocument).forEach((box) =>
        this.strokeCollisionRect(ctx, box, '#00ff00'),
      );
      getPlayerAttackBoxes(player, this.airDocument).forEach((box) =>
        this.strokeCollisionRect(ctx, box, '#ff0000'),
      );
      return;
    }

    this.strokeRect(ctx, getBodyBox(player), '#00ff00');
    if (isAttackActive(player)) this.strokeRect(ctx, getAttackBox(player), '#ff0000');
  }

  private strokeCollisionRect(
    ctx: CanvasRenderingContext2D,
    rect: ReturnType<typeof getPlayerAttackBoxes>[number],
    color: string,
  ): void {
    this.strokeRect(ctx, rect, color);
    ctx.fillStyle = color;
    ctx.font = '9px monospace';
    ctx.fillText(`${rect.kind}[${rect.boxIndex}] ${rect.source} a${rect.animNo}e${rect.elementIndex}`, rect.x, rect.y - 2);
  }

  private drawProjectileDebugBoxes(ctx: CanvasRenderingContext2D, projectiles: ProjectileState[]): void {
    projectiles.forEach((projectile) => this.strokeRect(ctx, getProjectileWorldBox(projectile), '#ff0000'));
  }

  private strokeRect(ctx: CanvasRenderingContext2D, rect: Rect, color: string): void {
    ctx.strokeStyle = color;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }
}

function resolveExplodBlend(
  transparency: string | null,
  alpha: { source: number; destination: number } | null,
): { compositeOperation: GlobalCompositeOperation; globalAlpha: number; limitation: string | null } {
  const mode = transparency?.trim().toLowerCase() ?? '';
  const globalAlpha = alpha ? Math.min(1, Math.max(0, alpha.source / 256)) : 1;
  if (mode === 'add' || mode === 'add1' || mode === 'addalpha') {
    return {
      compositeOperation: 'lighter',
      globalAlpha: mode === 'addalpha' ? globalAlpha : 1,
      limitation: mode === 'addalpha' && alpha && alpha.destination !== 0 ? 'destination_alpha_approximated' : null,
    };
  }
  if (mode === 'sub') return { compositeOperation: 'source-over', globalAlpha, limitation: 'subtractive_blend_unsupported' };
  return { compositeOperation: 'source-over', globalAlpha, limitation: null };
}

export function getPlayersInSpritePriorityOrder(state: GameState): PlayerState[] {
  return [...state.players].sort((a, b) => (a.sprPriority ?? 0) - (b.sprPriority ?? 0) || a.id - b.id);
}
