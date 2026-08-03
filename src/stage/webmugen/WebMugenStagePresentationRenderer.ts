import type { StageRenderContext } from '../StageRuntime';
import { CyberClasicStageRenderer } from './CyberClasicStageRenderer';
import { FreshClasicStageRenderer } from './FreshClasicStageRenderer';
import { WebMugenStageRenderer } from './WebMugenStageRenderer';
import type { WebMugenStageDefinition, WebMugenStagePresentation } from './WebMugenStageSchema';

export interface WebMugenStagePresentationRenderer {
  render(stage: WebMugenStageDefinition, context: StageRenderContext): void;
  dispose(): void;
}

export function createWebMugenStagePresentationRenderer(
  presentation: WebMugenStagePresentation,
): WebMugenStagePresentationRenderer {
  if (presentation === 'fresh-clasic') return new FreshClasicStageRenderer();
  if (presentation === 'cyber-clasic') return new CyberClasicStageRenderer();
  return new WebMugenStageRenderer();
}
