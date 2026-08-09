import { CanvasRenderer } from './CanvasRenderer';
import { resolveCanvasViewport, resolveViewportCamera } from '../../core/engine/ScreenSize';
import type { GameState, PlayerState } from '../../core/engine/types';
import type { HitFeedbackState } from '../../core/engine/HitFeedback';
import type { RoundState } from '../../core/engine/RoundState';
import type { RoundScore } from '../../core/engine/RoundScore';
import type { HudTheme, StageTheme } from '../../app/RuntimeSettings';

type RenderOptions = {
  collisionBoxesVisible?: boolean;
  diagnosticsEnabled?: boolean;
  hudVisible?: boolean;
  hudTheme?: HudTheme;
  stageTheme?: StageTheme;
};

type RenderMethod = (
  state: GameState,
  hitFeedback?: HitFeedbackState,
  roundState?: RoundState,
  roundScore?: RoundScore,
  options?: RenderOptions,
) => string[];

type PatchableRenderer = {
  canvas: HTMLCanvasElement;
  render: RenderMethod;
};

const prototype = CanvasRenderer.prototype as unknown as PatchableRenderer;
const originalRender = prototype.render;
const cachedOffsets = new WeakMap<object, number>();

prototype.render = function renderWithResponsiveBuiltInStagePlacement(
  state,
  hitFeedback,
  roundState,
  roundScore,
  options = {},
): string[] {
  if (!usesResponsiveBuiltInStagePlacement(options.stageTheme ?? 'fresh')) {
    return originalRender.call(this, state, hitFeedback, roundState, roundScore, options);
  }

  const viewport = resolveCanvasViewport(this.canvas.width, this.canvas.height);
  const camera = resolveViewportCamera(state, viewport.logicalWidth, viewport.logicalHeight);
  const groundedPlayerYs = resolveBuiltInStageGroundReferenceYs(state.players);

  let visualOffset = cachedOffsets.get(this) ?? 0;
  if (groundedPlayerYs.length > 0) {
    visualOffset = resolveBuiltInStageWorldVisualOffset(
      groundedPlayerYs,
      camera.y,
      viewport.logicalHeight,
    );
    cachedOffsets.set(this, visualOffset);
  }

  if (Math.abs(visualOffset) < 0.001) {
    return originalRender.call(this, state, hitFeedback, roundState, roundScore, options);
  }

  const adjustedState = {
    ...shiftBuiltInStageWorldVisuals(state, visualOffset),
    camera: { ...camera, viewportWidth: viewport.logicalWidth, viewportHeight: viewport.logicalHeight },
  };

  return originalRender.call(this, adjustedState, hitFeedback ? shiftHitFeedback(hitFeedback, visualOffset) : undefined, roundState, roundScore, options);
};

export function usesResponsiveBuiltInStagePlacement(stageTheme: StageTheme): boolean {
  return stageTheme === 'fresh'
    || stageTheme === 'cyber'
    || stageTheme === 'fresh-clasic'
    || stageTheme === 'cyber-clasic';
}

export function resolveBuiltInStageGroundReferenceYs(players: readonly PlayerState[]): number[] {
  return players
    .filter((player) => player.stateType === 'S' || player.stateType === 'C')
    .map((player) => player.y);
}

export function shiftBuiltInStageWorldVisuals(state: GameState, offsetY: number): GameState {
  return {
    ...state,
    players: state.players.map((player) => shiftPlayer(player, offsetY)) as GameState['players'],
    helpers: {
      ...state.helpers,
      entries: state.helpers.entries.map((helper) => ({
        ...helper,
        player: shiftPlayer(helper.player, offsetY),
      })),
    },
    projectiles: state.projectiles.map((projectile) => ({ ...projectile, y: projectile.y + offsetY })),
    explods: {
      ...state.explods,
      entries: state.explods.entries.map((entry) => entry.coordinateSpace === 'stage'
        ? { ...entry, position: { ...entry.position, y: entry.position.y + offsetY } }
        : entry),
    },
  };
}

export function resolveBuiltInStageWorldVisualOffset(
  groundedPlayerYs: readonly number[],
  cameraY: number,
  viewportHeight: number,
): number {
  if (groundedPlayerYs.length === 0) return 0;
  const currentGround = Math.max(...groundedPlayerYs.map((y) => y - cameraY));
  const bottomMargin = viewportHeight <= 240
    ? 18
    : Math.max(28, Math.round(viewportHeight * 0.055));
  return clamp(viewportHeight - bottomMargin - currentGround, -180, 180);
}

function shiftHitFeedback(feedback: HitFeedbackState, offsetY: number): HitFeedbackState {
  return { ...feedback, sparks: feedback.sparks.map((spark) => ({ ...spark, y: spark.y + offsetY })) };
}

function shiftPlayer(player: PlayerState, offsetY: number): PlayerState {
  return {
    ...player,
    y: player.y + offsetY,
    afterImage: player.afterImage
      ? {
          ...player.afterImage,
          frames: player.afterImage.frames.map((frame) => ({ ...frame, y: frame.y + offsetY })),
        }
      : player.afterImage,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
