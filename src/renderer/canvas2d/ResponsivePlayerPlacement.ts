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

prototype.render = function renderWithResponsiveFreshPlacement(
  state,
  hitFeedback,
  roundState,
  roundScore,
  options = {},
): string[] {
  if ((options.stageTheme ?? 'fresh') !== 'fresh') {
    return originalRender.call(this, state, hitFeedback, roundState, roundScore, options);
  }

  const viewport = resolveCanvasViewport(this.canvas.width, this.canvas.height);
  const camera = resolveViewportCamera(state, viewport.logicalWidth, viewport.logicalHeight);
  const grounded = state.players.filter((player) => player.stateType !== 'A');

  let visualOffset = cachedOffsets.get(this) ?? 0;
  if (grounded.length > 0) {
    const currentGround = Math.max(...grounded.map((player) => player.y - camera.y));
    const existingFreshOffset = Math.max(0, 285 - camera.y - viewport.logicalHeight * 0.78);
    const bottomMargin = viewport.logicalHeight <= 240
      ? 18
      : Math.max(28, Math.round(viewport.logicalHeight * 0.055));
    const desiredGround = viewport.logicalHeight - bottomMargin;
    visualOffset = clamp(desiredGround - currentGround - existingFreshOffset, -180, 180);
    cachedOffsets.set(this, visualOffset);
  }

  if (Math.abs(visualOffset) < 0.001) {
    return originalRender.call(this, state, hitFeedback, roundState, roundScore, options);
  }

  const adjustedState: GameState = {
    ...state,
    camera: { ...camera, viewportWidth: viewport.logicalWidth, viewportHeight: viewport.logicalHeight },
    players: state.players.map((player) => shiftPlayer(player, visualOffset)) as GameState['players'],
    helpers: {
      ...state.helpers,
      entries: state.helpers.entries.map((helper) => ({
        ...helper,
        player: shiftPlayer(helper.player, visualOffset),
      })),
    },
  };

  return originalRender.call(this, adjustedState, hitFeedback, roundState, roundScore, options);
};

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
