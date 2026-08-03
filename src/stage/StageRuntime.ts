import type { GameState } from '../core/engine/types';

export type StageBounds = { left: number; right: number; high: number; low: number };
export type StageCameraConfig = StageBounds & { verticalFollow: number; tension: number };

export type StageRenderContext = {
  ctx: CanvasRenderingContext2D;
  viewportWidth: number;
  viewportHeight: number;
  cameraX: number;
  cameraY: number;
};

export interface StageRuntime {
  readonly engine: 'winmugen' | 'webmugen';
  readonly id: string;
  update(state: GameState): void;
  render(context: StageRenderContext): void;
  getBounds(): StageBounds;
  getCameraConfig(): StageCameraConfig;
  getGroundY(): number;
  dispose(): void;
}
