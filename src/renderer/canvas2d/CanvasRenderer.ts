import type { AirDocument } from '../../parser/air/AirTypes';
import { getCurrentAnimationElement } from '../../core/animation/AnimationPlayer';
import { getPresentedAnimationTime } from '../../core/animation/PresentedAnimation';
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
  completeExtendedViewportExplodTiles,
  getExplodsInDrawOrder,
  resolveExplodRenderFrames,
  type CharacterRenderAssets,
  type ExplodRenderFrame,
} from './ExplodRender';
import { resolveBgPalFxFilter } from '../../core/palfx/BgPalFxSystem';
import {
  resolveCanvasViewport,
  resolveViewportCamera,
} from '../../core/engine/ScreenSize';
import type { HudTheme, StageTheme } from '../../app/RuntimeSettings';
import type { MugenStage } from '../../core/stage/MugenStage';
import type { StageRuntime } from '../../stage/StageRuntime';
import type { LifeBarRuntime } from '../../lifebar/LifeBarRuntime';
import { WinMugenStageRuntime } from '../../stage/winmugen/WinMugenStageRuntime';
export { resolveStageCameraPosition, resolveStageLayerPosition } from '../../stage/winmugen/WinMugenStageRenderer';

export type CanvasPresentationRuntimes = {
  stageRuntime: StageRuntime;
  lifeBarRuntime: LifeBarRuntime;
};

export class CanvasRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly imageDataSpriteRenderer = new ImageDataSpriteRenderer();
  private readonly hitFeedbackRenderer = new HitFeedbackRenderer();
  private readonly roundStateRenderer = new RoundStateRenderer();
  private subtractiveLayer: HTMLCanvasElement | null = null;
  private lastPowerHudSignature = '';
  private reportedInitialPower = false;
  private lastTimings = { normalMs: 0, debugMs: 0 };
  private readonly stageRuntime?: StageRuntime;
  private readonly lifeBarRuntime?: LifeBarRuntime;

  getLastTimings(): Readonly<{ normalMs: number; debugMs: number }> {
    return this.lastTimings;
  }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly airDocument?: AirDocument,
    private readonly spritePack?: SpritePack | null,
    private readonly imageDataSpritePack?: ImageDataSpritePack | null,
    private readonly ownerAssets: Partial<Record<1 | 2, CharacterRenderAssets>> = {},
    private readonly fightFxAssets?: CharacterRenderAssets,
    private readonly stage?: MugenStage | null,
    presentation?: Partial<CanvasPresentationRuntimes>,
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('CanvasRenderingContext2D is not available.');
    this.context = context;
    this.context.imageSmoothingEnabled = false;
    this.stageRuntime = presentation?.stageRuntime ?? (stage ? new WinMugenStageRuntime(stage) : undefined);
    this.lifeBarRuntime = presentation?.lifeBarRuntime;
  }

  render(
    state: GameState,
    hitFeedback?: HitFeedbackState,
    roundState?: RoundState,
    roundScore?: RoundScore,
    options: { collisionBoxesVisible?: boolean; diagnosticsEnabled?: boolean; hudVisible?: boolean; hudTheme?: HudTheme; stageTheme?: StageTheme } = {},
  ): string[] {
    const normalStartedAt = performance.now();
    const collisionBoxesVisible = options.collisionBoxesVisible ?? true;
    const diagnosticsEnabled = options.diagnosticsEnabled ?? true;
    const ctx = this.context;
    const viewport = resolveCanvasViewport(this.canvas.width, this.canvas.height);
    const camera = resolveViewportCamera(state, viewport.logicalWidth, viewport.logicalHeight);
    const winMugenViewport = viewport.renderScale === 2;
    const hudScale = winMugenViewport ? 0.5 : 1;
    const hudViewportWidth = winMugenViewport ? this.canvas.width : viewport.logicalWidth;
    const stageTheme = options.stageTheme ?? 'fresh';
    this.stageRuntime?.update(state);
    this.lifeBarRuntime?.update(state, roundState, roundScore);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const shake = getScreenShakeOffset(hitFeedback);
    ctx.save();
    ctx.scale(viewport.renderScale, viewport.renderScale);
    ctx.translate(shake.x, shake.y);
    const bgPalFxFilter = resolveBgPalFxFilter(state.bgPalFx);
    const globalFlags = new Set(state.players.flatMap((player) => player.assertSpecialFlags ?? []).map((flag) => flag.trim().toLowerCase()));
    if (!globalFlags.has('nobg')) {
      ctx.save();
      ctx.filter = bgPalFxFilter;
      if (this.stageRuntime) {
        this.stageRuntime.render({ ctx, viewportWidth: viewport.logicalWidth, viewportHeight: viewport.logicalHeight, cameraX: camera.x, cameraY: camera.y });
      } else {
        this.drawStage(ctx, viewport.logicalWidth, viewport.logicalHeight, camera.x, camera.y, stageTheme);
      }
      ctx.restore();
    }
    if (state.envColor?.under) this.drawEnvironmentColor(ctx, state.envColor.color, viewport.logicalWidth, viewport.logicalHeight);
    const hideBars = options.hudVisible === false || globalFlags.has('nobardisplay');
    ctx.save();
    ctx.scale(hudScale, hudScale);
    const lifeBarContext = { ctx, state, roundState, roundScore, viewportWidth: hudViewportWidth, diagnosticsEnabled };
    let powerDiagnostics: string[] = [];
    if (!hideBars && this.lifeBarRuntime) {
      powerDiagnostics = this.lifeBarRuntime.renderBehindPlayers(lifeBarContext);
    } else if (!hideBars) {
      this.drawLifeBars(ctx, state, hudViewportWidth, options.hudTheme ?? 'fresh');
      powerDiagnostics = this.drawPowerBars(ctx, state, diagnosticsEnabled, hudViewportWidth, options.hudTheme ?? 'fresh');
      if (roundState) this.roundStateRenderer.renderHud(ctx, roundState, roundScore, hudViewportWidth, options.hudTheme ?? 'fresh');
    }
    ctx.restore();
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    this.drawProjectiles(ctx, state.projectiles, diagnosticsEnabled);
    ctx.restore();
    const explodResolution = resolveExplodRenderFrames(state, this.defaultAssets(), this.ownerAssets, this.fightFxAssets, camera.x, camera.y, diagnosticsEnabled);
    const explodFrames = completeExtendedViewportExplodTiles(explodResolution.frames, viewport.logicalWidth);
    const renderDiagnostics = [
      ...(diagnosticsEnabled && globalFlags.has('nobg') ? ['raw.assertspecial_draw flag=noBG target=stage result=hidden'] : []),
      ...(diagnosticsEnabled && hideBars ? ['raw.assertspecial_draw flag=nobardisplay target=hud result=hidden'] : []),
      ...(diagnosticsEnabled && state.bgPalFx ? [`raw.bgpalfx_draw owner=${state.bgPalFx.ownerEntityId} remaining=${state.bgPalFx.remainingTime} color=${state.bgPalFx.color} invertall=${state.bgPalFx.invertAll ? 1 : 0} mul=(${state.bgPalFx.multiply.red},${state.bgPalFx.multiply.green},${state.bgPalFx.multiply.blue}) filter=${bgPalFxFilter} result=drawn limitation=canvas_filter_approximated`] : []),
      ...explodResolution.diagnosticLines,
      ...(diagnosticsEnabled && explodFrames.length > explodResolution.frames.length
        ? [`raw.explod_tile_extend viewport=${viewport.logicalWidth} authored=${explodResolution.frames.length} supplemental=${explodFrames.length - explodResolution.frames.length} result=drawn`]
        : []),
    ];
    const regularDrawables = [
      ...getPlayersInSpritePriorityOrder(state).map((player) => ({
        kind: 'player' as const,
        priority: player.sprPriority ?? 0,
        stableId: player.id,
        player,
        scaleX: player.collisionWidth?.xScale ?? 1,
        scaleY: player.collisionWidth?.yScale ?? 1,
      })),
      ...state.helpers.entries
        .filter((helper) => (
          helper.hasCompletedInitialStatePass !== false || helper.canRenderBeforeInitialStatePass === true
        ))
        .map((helper) => ({
          kind: 'helper' as const,
          priority: helper.player.sprPriority ?? 0,
          stableId: helper.entityId,
          player: helper.player,
          scaleX: helper.player.collisionWidth?.xScale ?? 1,
          scaleY: helper.player.collisionWidth?.yScale ?? 1,
        })),
      ...getExplodsInDrawOrder(explodFrames)
        .filter((frame) => !frame.entry.onTop)
        .map((frame) => ({
          kind: 'explod' as const,
          priority: frame.entry.spritePriority,
          stableId: frame.entry.runtimeId,
          frame,
        })),
    ].sort((a, b) => {
      const priorityOrder = a.priority - b.priority;
      if (priorityOrder !== 0) return priorityOrder;
      // Helpers and Explods are created after the root players. At equal
      // priority WinMUGEN queues those newer objects first, behind the older
      // root sprite. T-H-M-A State 3640 depends on its priority-5 full-screen
      // background Explod staying behind the priority-5 Action 3640 player.
      const kindOrder = drawableKindOrder(a.kind) - drawableKindOrder(b.kind);
      if (kindOrder !== 0) return kindOrder;
      return (a.kind === 'explod' && b.kind === 'explod') || (a.kind === 'helper' && b.kind === 'helper')
        ? b.stableId - a.stableId
        : a.stableId - b.stableId;
    });
    for (const drawable of regularDrawables) {
      if (drawable.kind !== 'explod') {
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        renderDiagnostics.push(...this.drawAfterImages(ctx, drawable.player, diagnosticsEnabled, drawable.scaleX, drawable.scaleY));
        const palFxFilter = resolveBgPalFxFilter(drawable.player.palFx);
        ctx.save();
        ctx.filter = palFxFilter;
        const diagnostic = this.drawPlayer(ctx, drawable.player, drawable.player.id === 1 ? '#66ccff' : '#ff99aa', diagnosticsEnabled, drawable.scaleX, drawable.scaleY);
        ctx.restore();
        if (diagnostic) renderDiagnostics.push(diagnostic);
        if (diagnosticsEnabled && drawable.player.palFx) renderDiagnostics.push(`raw.palfx_draw entity=p${drawable.player.id} remaining=${drawable.player.palFx.remainingTime} filter=${palFxFilter} result=drawn limitation=canvas_filter_approximated`);
        ctx.restore();
      } else {
        const diagnostic = this.drawExplod(ctx, drawable.frame, diagnosticsEnabled);
        if (diagnostic) renderDiagnostics.push(diagnostic);
      }
    }
    if (!globalFlags.has('nobg') && this.stageRuntime?.renderForeground) {
      ctx.save();
      ctx.filter = bgPalFxFilter;
      this.stageRuntime.renderForeground({ ctx, viewportWidth: viewport.logicalWidth, viewportHeight: viewport.logicalHeight, cameraX: camera.x, cameraY: camera.y });
      ctx.restore();
    }
    if (state.envColor && !state.envColor.under) this.drawEnvironmentColor(ctx, state.envColor.color, viewport.logicalWidth, viewport.logicalHeight);
    if (diagnosticsEnabled && state.envColor) {
      renderDiagnostics.push(`raw.envcolor_draw owner=${state.envColor.ownerEntityId} remaining=${state.envColor.remainingTime} color=(${state.envColor.color.red},${state.envColor.color.green},${state.envColor.color.blue}) under=${state.envColor.under ? 1 : 0} result=drawn`);
    }
    if ((state.pause?.superPauseTime ?? 0) > 0 && state.pause?.darken) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, viewport.logicalWidth, viewport.logicalHeight);
      if (diagnosticsEnabled) {
        renderDiagnostics.push(`raw.superpause_darken remaining=${state.pause.superPauseTime} opacity=0.5 layer=before_ontop result=drawn`);
      }
    }
    if (hitFeedback) this.hitFeedbackRenderer.render(ctx, hitFeedback);
    for (const frame of getExplodsInDrawOrder(explodFrames).filter((candidate) => candidate.entry.onTop)) {
      const diagnostic = this.drawExplod(ctx, frame, diagnosticsEnabled);
      if (diagnostic) renderDiagnostics.push(diagnostic);
    }
    if (roundState && !hideBars) {
      ctx.save();
      ctx.scale(hudScale, hudScale);
      if (this.lifeBarRuntime) this.lifeBarRuntime.renderForeground({ ...lifeBarContext, ctx });
      else this.roundStateRenderer.renderPresentation(ctx, roundState, hudViewportWidth);
      ctx.restore();
    }
    const normalFinishedAt = performance.now();
    const debugStartedAt = normalFinishedAt;
    if (collisionBoxesVisible) {
      ctx.save();
      ctx.translate(-camera.x, -camera.y);
      this.drawDebugBoxes(ctx, state.players[0]);
      this.drawDebugBoxes(ctx, state.players[1]);
      state.helpers.entries.forEach((helper) => this.drawDebugBoxes(ctx, helper.player));
      this.drawProjectileDebugBoxes(ctx, state.projectiles);
      ctx.restore();
    }
    this.lastTimings = {
      normalMs: normalFinishedAt - normalStartedAt,
      debugMs: collisionBoxesVisible ? performance.now() - debugStartedAt : 0,
    };
    ctx.restore();
    return [...powerDiagnostics, ...renderDiagnostics];
  }

  dispose(): void {
    this.stageRuntime?.dispose();
    this.lifeBarRuntime?.dispose();
  }

  private defaultAssets(): CharacterRenderAssets {
    return {
      airDocument: this.airDocument,
      spritePack: this.spritePack,
      imageDataSpritePack: this.imageDataSpritePack,
    };
  }

  private drawStage(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number, cameraX: number, cameraY: number, theme: StageTheme): void {
    if (theme === 'cyber') {
      const cameraOffsetY = 65 - cameraY;
      const horizonY = viewportHeight * 0.48 + cameraOffsetY;
      ctx.fillStyle = linearGradient(ctx, 0, 0, 0, viewportHeight, '#071225', '#17365b');
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
      for (let y = horizonY; y < viewportHeight; y += 12) ctx.fillRect(0, y, viewportWidth, 1);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      if (typeof ctx.beginPath === 'function' && typeof ctx.moveTo === 'function' && typeof ctx.lineTo === 'function') {
        for (let x = -viewportWidth; x < viewportWidth * 2; x += 24) {
          ctx.beginPath();
          ctx.moveTo(viewportWidth / 2, horizonY);
          ctx.lineTo(x, viewportHeight);
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
      ctx.fillRect(0, viewportHeight * 0.84, viewportWidth, viewportHeight * 0.16);
      return;
    }
    const cameraOffsetY = 65 - cameraY;
    const splitY = Math.min(viewportHeight, viewportHeight * 0.65 + cameraOffsetY);
    ctx.fillStyle = linearGradient(ctx, 0, 0, 0, splitY, '#7eb6d8', '#d7edf5');
    ctx.fillRect(0, 0, viewportWidth, splitY);
    if (typeof ctx.arc === 'function') {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 244, 184, 0.78)';
      ctx.arc(viewportWidth * 0.78, viewportHeight * 0.22, viewportHeight * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    if (typeof ctx.beginPath === 'function' && typeof ctx.moveTo === 'function' && typeof ctx.lineTo === 'function') {
      ctx.beginPath();
      ctx.moveTo(0, splitY);
      ctx.lineTo(viewportWidth * 0.2, splitY * 0.62);
      ctx.lineTo(viewportWidth * 0.38, splitY);
      ctx.lineTo(viewportWidth * 0.61, splitY * 0.56);
      ctx.lineTo(viewportWidth * 0.86, splitY);
      ctx.fillStyle = 'rgba(64, 112, 98, 0.52)';
      ctx.fill();
    }
    ctx.fillStyle = linearGradient(ctx, 0, splitY, 0, viewportHeight, '#6f984e', '#294b2c');
    ctx.fillRect(0, splitY, viewportWidth, viewportHeight - splitY);
    ctx.fillStyle = '#26351e';
    const groundY = viewportWidth === 320 && viewportHeight === 240 ? 220 : 285;
    ctx.fillRect(0, groundY, viewportWidth, Math.max(0, viewportHeight - groundY));
  }

  private drawEnvironmentColor(ctx: CanvasRenderingContext2D, color: { red: number; green: number; blue: number }, viewportWidth: number, viewportHeight: number): void {
    const channel = (value: number): number => Math.max(0, Math.min(255, Math.trunc(value)));
    ctx.fillStyle = `rgb(${channel(color.red)}, ${channel(color.green)}, ${channel(color.blue)})`;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  }

  private drawLifeBars(ctx: CanvasRenderingContext2D, state: GameState, viewportWidth = this.canvas.width, theme: HudTheme = 'fresh'): void {
    const [p1, p2] = state.players;
    const offsetX = (viewportWidth - 640) / 2;
    const y = 16;
    ctx.fillStyle = theme === 'cyber' ? 'rgba(2, 8, 23, 0.9)' : 'rgba(30, 41, 59, 0.88)';
    ctx.fillRect(18 + offsetX, y - 2, 264, 20);
    ctx.fillRect(358 + offsetX, y - 2, 264, 20);
    ctx.fillStyle = theme === 'cyber' ? '#06b6d4' : '#38c96b';
    ctx.fillRect(20 + offsetX, y, 260 * (p1.life / 1000), 14);
    ctx.fillRect(620 + offsetX - 260 * (p2.life / 1000), y, 260 * (p2.life / 1000), 14);
    ctx.fillStyle = theme === 'cyber' ? 'rgba(165, 243, 252, 0.38)' : 'rgba(255,255,255,0.35)';
    ctx.fillRect(20 + offsetX, y, 260 * (p1.life / 1000), 3);
    ctx.fillRect(620 + offsetX - 260 * (p2.life / 1000), y, 260 * (p2.life / 1000), 3);
    ctx.strokeStyle = theme === 'cyber' ? '#67e8f9' : '#dbeafe';
    ctx.strokeRect(18.5 + offsetX, y - 2.5, 263, 19);
    ctx.strokeRect(358.5 + offsetX, y - 2.5, 263, 19);
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: ProjectileState[], diagnosticsEnabled: boolean): void {
    for (const projectile of projectiles) {
      const currentElement = this.airDocument
        ? getCurrentAnimationElement(this.airDocument, projectile.animNo, projectile.animTime)
        : null;

      if (currentElement) {
        const blend = resolveSpriteBlend(currentElement.element.blend ?? null, null);
        ctx.save();
        applySpriteBlend(ctx, blend);
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
          undefined,
          1,
          projectile.scaleX ?? 1,
          projectile.scaleY ?? 1,
          false,
          diagnosticsEnabled,
          blend.subtractive,
        );
        ctx.restore();

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

  private drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerState, color: string, diagnosticsEnabled: boolean, scaleX = 1, scaleY = 1): string {
    const hasOwnerAssetMap = Object.keys(this.ownerAssets).length > 0;
    const animationOwner = player.animationOwnerId ?? player.id;
    const spriteOwner = player.selfStateOwnerId ?? player.id;
    const animationAssets = this.ownerAssets[animationOwner] ?? (hasOwnerAssetMap ? undefined : this.defaultAssets());
    const spriteAssets = this.ownerAssets[spriteOwner] ?? (hasOwnerAssetMap ? undefined : this.defaultAssets());
    const stateOwner = player.stateOwnerId ?? player.id;
    const prefix = diagnosticsEnabled
      ? `raw.render entity=p${player.id} state=${player.stateNo} anim=${player.animNo} stateOwner=${stateOwner} animOwner=${animationOwner} spriteOwner=${spriteOwner} drawAngle=${player.drawAngle ?? 0} drawScale=(${player.drawScale?.x ?? 1},${player.drawScale?.y ?? 1})`
      : '';
    if (!animationAssets) return diagnosticsEnabled ? `${prefix} result=skip reason=animation_owner_missing playerVisible=0 rendererDrawRequested=0` : '';
    if (!spriteAssets) return diagnosticsEnabled ? `${prefix} result=skip reason=sprite_owner_missing playerVisible=0 rendererDrawRequested=0` : '';

    const assertSpecial = (player.assertSpecialFlags ?? (player as PlayerState & { runtime?: { assertSpecial?: string[] } }).runtime?.assertSpecial ?? [])
      .map((flag) => flag.trim().toLowerCase());
    if (assertSpecial.includes('invisible')) {
      return diagnosticsEnabled ? `${prefix} result=skip reason=entity_invisible playerVisible=0 assertSpecialInvisible=1 rendererDrawRequested=0` : '';
    }

    if (!animationAssets.airDocument && (spriteAssets.imageDataSpritePack || spriteAssets.spritePack)) {
      return diagnosticsEnabled ? `${prefix} result=skip reason=animation_owner_missing animExists=0 playerVisible=0 rendererDrawRequested=0` : '';
    }

    const action = animationAssets.airDocument?.actions.find((candidate) => candidate.actionNo === player.animNo);
    if (animationAssets.airDocument && !action) {
      return diagnosticsEnabled ? `${prefix} result=skip reason=air_action_missing animExists=0 playerVisible=0 rendererDrawRequested=0` : '';
    }
    const currentElement = animationAssets.airDocument
      ? getCurrentAnimationElement(animationAssets.airDocument, player.animNo, getPresentedAnimationTime(player))
      : null;

    if (action && !currentElement) {
      return diagnosticsEnabled ? `${prefix} result=skip reason=air_element_missing animExists=1 playerVisible=0 rendererDrawRequested=0` : '';
    }

    if (currentElement) {
      const { groupNo, imageNo } = currentElement.element;
      const elementFields = diagnosticsEnabled ? `animExists=1 airElementIndex=${currentElement.elementIndex + 1} airElementSpriteGroup=${groupNo} airElementSpriteIndex=${imageNo}` : '';
      if (groupNo < 0 || imageNo < 0) {
        return diagnosticsEnabled ? `${prefix} ${elementFields} result=skip reason=intentional_invisible_element spriteExists=0 playerVisible=0 rendererDrawRequested=0` : '';
      }
      const blend = resolveSpriteBlend(currentElement.element.blend ?? null, null);
      ctx.save();
      applySpriteBlend(ctx, blend);
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
        spriteAssets,
        1,
        scaleX,
        scaleY,
        false,
        diagnosticsEnabled,
        blend.subtractive,
        player.drawAngle !== undefined || player.drawScale ? {
          angleRadians: -(player.drawAngle ?? 0) * player.facing * Math.PI / 180,
          scaleX: player.drawScale?.x ?? 1,
          scaleY: player.drawScale?.y ?? 1,
        } : undefined,
      );
      ctx.restore();

      if (drawn.drawn) return diagnosticsEnabled ? `${prefix} ${elementFields} scale=(${scaleX},${scaleY}) airBlend=${blend.mode || 'none'} composite=${describeSpriteComposite(blend)} spriteExists=1 result=drawn playerVisible=1 rendererDrawRequested=1 ${drawn.diagnostic}${blend.limitation ? ` limitation=${blend.limitation}` : ''}` : '';
      if (spriteAssets.imageDataSpritePack || spriteAssets.spritePack) {
        return diagnosticsEnabled ? `${prefix} ${elementFields} spriteExists=0 result=skip reason=sprite_missing playerVisible=0 rendererDrawRequested=0` : '';
      }
    }

    ctx.save();
    if (player.drawAngle !== undefined || player.drawScale) {
      ctx.translate(player.x, player.y);
      ctx.rotate(-(player.drawAngle ?? 0) * player.facing * Math.PI / 180);
      ctx.scale(player.drawScale?.x ?? 1, player.drawScale?.y ?? 1);
      ctx.translate(-player.x, -player.y);
    }
    this.drawFallbackPlayer(ctx, player, color, currentElement);
    ctx.restore();
    return diagnosticsEnabled ? `${prefix} result=fallback reason=no_character_sprite_assets playerVisible=1 rendererDrawRequested=1 rendererDrawSource=debug_fallback` : '';
  }

  private drawAfterImages(ctx: CanvasRenderingContext2D, player: PlayerState, diagnosticsEnabled: boolean, scaleX = 1, scaleY = 1): string[] {
    const afterImage = player.afterImage;
    if (!afterImage?.enabled || afterImage.frames.length === 0) return [];
    const hasOwnerAssetMap = Object.keys(this.ownerAssets).length > 0;
    const assets = this.ownerAssets[player.id] ?? (hasOwnerAssetMap ? undefined : this.defaultAssets());
    if (!assets?.airDocument) return diagnosticsEnabled
      ? [`raw.afterimage_draw entity=p${player.id} result=hidden reason=animation_owner_missing`]
      : [];

    const displayed = afterImage.frames.filter((_, index) => index % afterImage.frameGap === 0).reverse();
    const blend = resolveSpriteBlend(afterImage.transparency, null);
    let drawn = 0;
    for (const [displayIndex, frame] of displayed.entries()) {
      const currentElement = getCurrentAnimationElement(assets.airDocument, frame.animNo, frame.animTime);
      if (!currentElement || currentElement.element.groupNo < 0 || currentElement.element.imageNo < 0) continue;
      ctx.save();
      applySpriteBlend(ctx, blend);
      ctx.filter = resolveAfterImageFilter(afterImage, displayed.length - displayIndex - 1);
      const result = this.drawSpriteByElement(
        ctx,
        currentElement.element.groupNo,
        currentElement.element.imageNo,
        frame.x,
        frame.y,
        frame.facing,
        currentElement.element.offsetX,
        currentElement.element.offsetY,
        currentElement.element.flip,
        assets,
        1,
        scaleX,
        scaleY,
        false,
        diagnosticsEnabled,
        blend.subtractive,
        frame.drawAngle !== undefined || frame.drawScale ? {
          angleRadians: -(frame.drawAngle ?? 0) * frame.facing * Math.PI / 180,
          scaleX: frame.drawScale?.x ?? 1,
          scaleY: frame.drawScale?.y ?? 1,
        } : undefined,
      );
      ctx.restore();
      if (result.drawn) drawn += 1;
    }
    if (!diagnosticsEnabled) return [];
    return [`raw.afterimage_draw entity=p${player.id} captured=${afterImage.frames.length} displayed=${displayed.length} drawn=${drawn} time=${afterImage.remainingTime} timegap=${afterImage.timeGap} framegap=${afterImage.frameGap} trans=${blend.mode || 'none'} composite=${describeSpriteComposite(blend)} palette=canvas_filter_approximated${blend.limitation ? ` limitation=${blend.limitation}` : ''}`];
  }

  private drawPowerBars(ctx: CanvasRenderingContext2D, state: GameState, diagnosticsEnabled: boolean, viewportWidth = this.canvas.width, theme: HudTheme = 'fresh'): string[] {
    const [p1, p2] = state.players;
    const p1Ratio = getPlayerPowerRatio(p1);
    const p2Ratio = getPlayerPowerRatio(p2);
    const offsetX = (viewportWidth - 640) / 2;
    const gaugeWidth = 130;
    ctx.fillStyle = theme === 'cyber' ? 'rgba(2, 8, 23, 0.94)' : 'rgba(30, 41, 59, 0.9)';
    ctx.fillRect(18 + offsetX, 35, 134, 12);
    ctx.fillRect(488 + offsetX, 35, 134, 12);
    ctx.fillStyle = theme === 'cyber' ? '#d946ef' : '#38bdf8';
    ctx.fillRect(20 + offsetX, 37, gaugeWidth * p1Ratio, 8);
    ctx.fillRect(620 + offsetX - gaugeWidth * p2Ratio, 37, gaugeWidth * p2Ratio, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.36)';
    ctx.fillRect(20 + offsetX, 37, gaugeWidth * p1Ratio, 2);
    ctx.fillRect(620 + offsetX - gaugeWidth * p2Ratio, 37, gaugeWidth * p2Ratio, 2);
    ctx.strokeStyle = theme === 'cyber' ? '#f0abfc' : '#dbeafe';
    ctx.strokeRect(18.5 + offsetX, 35.5, 133, 11);
    ctx.strokeRect(488.5 + offsetX, 35.5, 133, 11);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textBaseline = 'middle';
    if (p1.infinitePower) {
      ctx.textAlign = 'right';
      ctx.fillText('∞', 154 + offsetX, 45);
    }
    if (p2.infinitePower) {
      ctx.textAlign = 'left';
      ctx.fillText('∞', 476 + offsetX, 45);
    }

    const p1Power = p1.power ?? 0;
    const p2Power = p2.power ?? 0;
    const p1PowerMax = p1.powerMax ?? 3000;
    const p2PowerMax = p2.powerMax ?? 3000;
    const infiniteMode = p1.infinitePower && p2.infinitePower ? 'both' : p1.infinitePower ? 'p1' : p2.infinitePower ? 'p2' : 'off';
    const signature = `${p1Power}/${p1PowerMax}|${p2Power}/${p2PowerMax}|${infiniteMode}`;
    if (!diagnosticsEnabled || signature === this.lastPowerHudSignature) return [];
    this.lastPowerHudSignature = signature;
    const diagnostics = [`raw.power_hud p1=${p1Power}/${p1PowerMax} width=${gaugeWidth * p1Ratio} p2=${p2Power}/${p2PowerMax} width=${gaugeWidth * p2Ratio} infinite=${infiniteMode}`];
    if (!this.reportedInitialPower) {
      this.reportedInitialPower = true;
      diagnostics.unshift(
        `raw.power entity=p1 source=initial before=0 delta=${p1Power} after=${p1Power} max=${p1PowerMax}`,
        `raw.power entity=p2 source=initial before=0 delta=${p2Power} after=${p2Power} max=${p2PowerMax}`,
      );
    }
    return diagnostics;
  }

  private drawExplod(ctx: CanvasRenderingContext2D, frame: ExplodRenderFrame, diagnosticsEnabled: boolean): string {
    const { entry, currentElement } = frame;
    const controllerTransparency = entry.render.transparency?.trim().toLowerCase() === 'default' ? null : entry.render.transparency;
    const effectiveTransparency = controllerTransparency ?? currentElement.element.blend ?? null;
    const blend = resolveSpriteBlend(effectiveTransparency, controllerTransparency ? entry.render.alpha : null);
    ctx.save();
    applySpriteBlend(ctx, blend);
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
      diagnosticsEnabled,
      blend.subtractive,
    );
    ctx.restore();
    if (!diagnosticsEnabled) return '';
    return `raw.explod_draw internalId=${entry.runtimeId} mugenId=${entry.mugenId} anim=${entry.animationSource === 'fightfx' ? 'F' : ''}${entry.animNo} elem=${currentElement.elementIndex + 1} screen=(${frame.screenX},${frame.screenY}) facing=${entry.facing} vfacing=${entry.verticalFacing} scale=(${entry.render.scaleX},${entry.render.scaleY}) trans=${blend.mode || 'none'} alpha=(${blend.sourceAlpha},${blend.destinationAlpha}) composite=${describeSpriteComposite(blend)} ownpal=${entry.render.ownPalette ? 1 : 0} shadow=(${entry.render.shadow.red},${entry.render.shadow.green},${entry.render.shadow.blue}) sprpriority=${entry.spritePriority} ontop=${entry.onTop ? 1 : 0} result=${drawResult.drawn ? 'drawn' : 'hidden'}${drawResult.drawn ? ` ${drawResult.diagnostic}` : ' reason=sprite_not_found'} transSource=${controllerTransparency ? 'controller' : currentElement.element.blend ? 'air' : 'default'}${blend.limitation ? ` limitation=${blend.limitation}` : ''}${entry.render.ownPalette ? ' limitation_ownpal=dynamic_palette_effects_unverified' : ''}${entry.render.shadow.red || entry.render.shadow.green || entry.render.shadow.blue ? ' limitation_shadow=no_effect_shadow_pass' : ''}`;
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
    diagnosticsEnabled = true,
    subtractive = false,
    drawTransform?: { angleRadians: number; scaleX: number; scaleY: number },
  ): { drawn: boolean; diagnostic: string } {
    const flipX = flip.toUpperCase().includes('H');
    const flipY = flip.toUpperCase().includes('V');
    const key = spriteKey(groupNo, imageNo);

    const imageDataSprite = assets.imageDataSpritePack?.sprites.get(key);
    if (imageDataSprite) {
      const resolved = this.imageDataSpriteRenderer.resolveCanvas(assets.imageDataSpritePack, groupNo, imageNo, ownPalette, diagnosticsEnabled);
      if (!resolved) return { drawn: false, diagnostic: '' };

      this.drawSpriteCanvas(
        ctx, resolved.canvas, x, y, facing * (flipX ? -1 : 1) * scaleX, verticalFacing * (flipY ? -1 : 1) * scaleY,
        -imageDataSprite.xAxis + (drawTransform ? 0 : offsetX),
        -imageDataSprite.yAxis + (drawTransform ? 0 : offsetY),
        subtractive, drawTransform ? offsetX : 0, drawTransform ? offsetY : 0, drawTransform,
      );
      return { drawn: true, diagnostic: resolved.diagnostic };
    }

    const sprite = findSprite(assets.spritePack, groupNo, imageNo);
    if (sprite) {
      this.drawSpriteCanvas(
        ctx, sprite.image, x, y, facing * (flipX ? -1 : 1) * scaleX, verticalFacing * (flipY ? -1 : 1) * scaleY,
        -sprite.xAxis + (drawTransform ? 0 : offsetX),
        -sprite.yAxis + (drawTransform ? 0 : offsetY),
        subtractive, drawTransform ? offsetX : 0, drawTransform ? offsetY : 0, drawTransform,
      );
      return { drawn: true, diagnostic: 'sprite=bitmap cache=external' };
    }

    return { drawn: false, diagnostic: '' };
  }

  private drawSpriteCanvas(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    drawX: number,
    drawY: number,
    subtractive: boolean,
    offsetX = 0,
    offsetY = 0,
    drawTransform?: { angleRadians: number; scaleX: number; scaleY: number },
  ): void {
    if (subtractive && this.drawSubtractiveSprite(ctx, source, x, y, scaleX, scaleY, drawX, drawY, offsetX, offsetY, drawTransform)) return;
    ctx.save();
    this.applySpriteTransform(ctx, x, y, scaleX, scaleY, offsetX, offsetY, drawTransform);
    ctx.drawImage(source, drawX, drawY);
    ctx.restore();
  }

  private applySpriteTransform(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    offsetX: number,
    offsetY: number,
    drawTransform?: { angleRadians: number; scaleX: number; scaleY: number },
  ): void {
    ctx.translate(x, y);
    // AIR offsets move the sprite axis and are affected by scale, but WinMUGEN
    // does not rotate that displacement. Rotate only after reaching the
    // offset-adjusted sprite axis.
    ctx.translate(
      scaleX * offsetX * (drawTransform?.scaleX ?? 1),
      scaleY * offsetY * (drawTransform?.scaleY ?? 1),
    );
    if (drawTransform) {
      ctx.rotate(drawTransform.angleRadians);
      ctx.scale(drawTransform.scaleX, drawTransform.scaleY);
    }
    ctx.scale(scaleX, scaleY);
  }

  private drawSubtractiveSprite(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    drawX: number,
    drawY: number,
    offsetX: number,
    offsetY: number,
    drawTransform?: { angleRadians: number; scaleX: number; scaleY: number },
  ): boolean {
    if (typeof document === 'undefined' || typeof ctx.getTransform !== 'function' || typeof ctx.setTransform !== 'function') return false;
    const layer = this.subtractiveLayer ?? document.createElement('canvas');
    this.subtractiveLayer = layer;
    if (layer.width !== this.canvas.width) layer.width = this.canvas.width;
    if (layer.height !== this.canvas.height) layer.height = this.canvas.height;
    const layerContext = layer.getContext('2d');
    if (!layerContext) return false;

    layerContext.save();
    layerContext.setTransform(1, 0, 0, 1, 0, 0);
    layerContext.clearRect(0, 0, layer.width, layer.height);
    // WinMUGEN's framebuffer is opaque black even while AssertSpecial noBG
    // hides the stage. Canvas clear pixels are transparent, so seed the
    // inverted destination with white before applying D - S. Otherwise an S
    // sprite drawn outside opaque content becomes an inverted yellow/white
    // sprite instead of disappearing against black.
    layerContext.fillStyle = '#fff';
    layerContext.fillRect(0, 0, layer.width, layer.height);
    layerContext.globalAlpha = 1;
    layerContext.globalCompositeOperation = 'source-over';
    layerContext.filter = 'invert(1)';
    layerContext.drawImage(this.canvas, 0, 0);
    layerContext.restore();

    layerContext.save();
    layerContext.setTransform(ctx.getTransform());
    this.applySpriteTransform(layerContext, x, y, scaleX, scaleY, offsetX, offsetY, drawTransform);
    layerContext.globalAlpha = ctx.globalAlpha;
    layerContext.globalCompositeOperation = 'lighter';
    layerContext.filter = ctx.filter;
    layerContext.drawImage(source, drawX, drawY);
    layerContext.restore();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'invert(1)';
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
    return true;
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

type ResolvedSpriteBlend = {
  mode: string;
  compositeOperation: GlobalCompositeOperation;
  globalAlpha: number;
  sourceAlpha: number;
  destinationAlpha: number;
  limitation: string | null;
  subtractive: boolean;
};

function resolveAfterImageFilter(afterImage: NonNullable<PlayerState['afterImage']>, historyIndex: number): string {
  const average = (color: { red: number; green: number; blue: number }): number => (color.red + color.green + color.blue) / 3;
  const repeatedMultiplier = Math.pow(Math.max(0, average(afterImage.palette.multiply)), historyIndex);
  const repeatedAdd = historyIndex * average(afterImage.palette.add) / 255;
  const brightness = Math.max(0, repeatedMultiplier + repeatedAdd + (average(afterImage.palette.bright) + average(afterImage.palette.postBright)) / 255);
  const contrast = Math.max(0, average(afterImage.palette.contrast) / 256);
  const grayscale = Math.min(1, Math.max(0, 1 - afterImage.palette.color / 256));
  return `${afterImage.palette.invertAll ? 'invert(1) ' : ''}grayscale(${grayscale}) contrast(${contrast}) brightness(${brightness})`;
}

function resolveSpriteBlend(
  transparency: string | null,
  alpha: { source: number; destination: number } | null,
): ResolvedSpriteBlend {
  const mode = transparency?.trim().toLowerCase() ?? '';
  const airAlpha = mode.match(/^as(\d+)d(\d+)$/);
  const sourceAlpha = alpha?.source ?? (airAlpha ? Number(airAlpha[1]) : 256);
  const destinationAlpha = alpha?.destination ?? (airAlpha ? Number(airAlpha[2]) : mode === 'a' ? 256 : mode === 'a1' ? 128 : 0);
  const globalAlpha = Math.min(1, Math.max(0, sourceAlpha / 256));
  if (mode === 'a' || mode === 'a1' || airAlpha || mode === 'add' || mode === 'add1' || mode === 'addalpha') {
    const approximatedAirAdd = mode === 'a';
    return {
      mode: transparency?.trim() ?? '',
      compositeOperation: 'lighter',
      globalAlpha: approximatedAirAdd ? 0.5 : mode === 'add' || mode === 'add1' ? 1 : globalAlpha,
      sourceAlpha,
      destinationAlpha,
      limitation: approximatedAirAdd
        ? 'air_a_source_alpha_approximated'
        : destinationAlpha !== 0 && destinationAlpha !== 256 ? 'destination_alpha_approximated' : null,
      subtractive: false,
    };
  }
  if (mode === 's' || mode === 'sub') return { mode: transparency?.trim() ?? '', compositeOperation: 'source-over', globalAlpha, sourceAlpha, destinationAlpha, limitation: null, subtractive: true };
  return { mode: transparency?.trim() ?? '', compositeOperation: 'source-over', globalAlpha, sourceAlpha, destinationAlpha, limitation: null, subtractive: false };
}

function applySpriteBlend(ctx: CanvasRenderingContext2D, blend: ResolvedSpriteBlend): void {
  ctx.globalCompositeOperation = blend.compositeOperation;
  ctx.globalAlpha = blend.globalAlpha;
}

function describeSpriteComposite(blend: ResolvedSpriteBlend): string {
  return blend.subtractive ? 'subtractive' : blend.compositeOperation;
}

function linearGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  startColor: string,
  endColor: string,
): CanvasGradient | string {
  if (typeof ctx.createLinearGradient !== 'function') return startColor;
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);
  return gradient;
}

export function getPlayersInSpritePriorityOrder(state: GameState): PlayerState[] {
  return [...state.players].sort((a, b) => (a.sprPriority ?? 0) - (b.sprPriority ?? 0) || a.id - b.id);
}

function drawableKindOrder(kind: 'helper' | 'player' | 'explod'): number {
  if (kind === 'helper') return 0;
  if (kind === 'explod') return 1;
  return 2;
}
