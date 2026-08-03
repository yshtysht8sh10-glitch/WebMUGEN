import type { GameState } from '../../core/engine/types';
import type { StageCameraConfig, StageRenderContext, StageRuntime } from '../StageRuntime';
import { createWebMugenStagePresentationRenderer, type WebMugenStagePresentationRenderer } from './WebMugenStagePresentationRenderer';
import type { WebMugenStageDefinition } from './WebMugenStageSchema';

export class WebMugenStageRuntime implements StageRuntime {
  readonly engine = 'webmugen' as const;
  readonly id: string;
  private readonly renderer: WebMugenStagePresentationRenderer;
  constructor(private readonly definition: WebMugenStageDefinition) {
    this.id = definition.id;
    this.renderer = createWebMugenStagePresentationRenderer(definition.presentation);
  }
  update(_state: GameState): void {}
  render(context: StageRenderContext): void { this.renderer.render(this.definition, context); }
  getBounds() { const c = this.definition.camera; return { left: c.boundLeft, right: c.boundRight, high: c.boundHigh, low: c.boundLow }; }
  getCameraConfig(): StageCameraConfig { return { ...this.getBounds(), verticalFollow: this.definition.camera.verticalFollow, tension: this.definition.camera.tension }; }
  getGroundY(): number { return this.definition.groundY; }
  dispose(): void { this.renderer.dispose(); }
}
