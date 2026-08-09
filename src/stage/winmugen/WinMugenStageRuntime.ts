import type { GameState } from '../../core/engine/types';
import type { StageCameraConfig, StageRenderContext, StageRuntime } from '../StageRuntime';
import { WinMugenStageRenderer } from './WinMugenStageRenderer';
import type { WinMugenStageDefinition } from './WinMugenStageTypes';

export class WinMugenStageRuntime implements StageRuntime {
  readonly engine = 'winmugen' as const;
  readonly id: string;
  private readonly renderer = new WinMugenStageRenderer();

  constructor(private readonly definition: WinMugenStageDefinition) {
    this.id = definition.defPath;
  }
  update(_state: GameState): void {}
  render(context: StageRenderContext): void { this.renderer.render(this.definition, context); }
  getBounds() { return { left: this.definition.camera.boundLeft, right: this.definition.camera.boundRight, high: this.definition.camera.boundHigh, low: this.definition.camera.boundLow }; }
  getCameraConfig(): StageCameraConfig { return { ...this.getBounds(), verticalFollow: this.definition.camera.verticalFollow, tension: this.definition.camera.tension }; }
  getGroundY(): number { return this.definition.zOffset; }
  isAutoTurnEnabled(): boolean { return this.definition.autoTurn !== false; }
  dispose(): void {}
}
