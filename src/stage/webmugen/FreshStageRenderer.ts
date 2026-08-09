import { MUGEN_WORLD_ORIGIN_X } from '../../core/engine/ScreenSize';
import type { StageRenderContext } from '../StageRuntime';
import type { WebMugenStageDefinition } from './WebMugenStageSchema';

type ImageState = { image: HTMLImageElement | null; failed: boolean };

const STRIP_HEIGHT = 4;

type DepthPanoramaOptions = {
  fallbackColor: string;
  farCameraFactor: number;
  transitionStart: number;
  transitionEnd: number;
};

export class DepthPanoramaStageRenderer {
  private imageState: ImageState | undefined;

  constructor(private readonly options: DepthPanoramaOptions) {}

  render(stage: WebMugenStageDefinition, context: StageRenderContext): void {
    const { ctx, viewportWidth, viewportHeight, cameraX } = context;
    const layer = stage.layers[0];
    const state = layer ? this.getImage(layer.src) : undefined;
    if (!state?.image || !state.image.complete || state.image.naturalWidth === 0) {
      ctx.fillStyle = this.options.fallbackColor;
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);
      return;
    }

    const cameraDeltaX = cameraX - (MUGEN_WORLD_ORIGIN_X - viewportWidth / 2);
    const overscan = Math.max(48, Math.ceil(Math.hypot(viewportWidth, viewportHeight) * 0.08));
    const scale = Math.max(
      (viewportWidth + overscan * 2) / state.image.naturalWidth,
      (viewportHeight + overscan * 2) / state.image.naturalHeight,
    );
    const drawWidth = state.image.naturalWidth * scale;
    const drawHeight = state.image.naturalHeight * scale;
    const baseX = (viewportWidth - drawWidth) / 2;
    const drawY = (viewportHeight - drawHeight) / 2;

    for (let y = 0; y < viewportHeight; y += STRIP_HEIGHT) {
      const stripHeight = Math.min(STRIP_HEIGHT, viewportHeight - y);
      const factor = resolveDepthCameraFactor((y + stripHeight / 2) / viewportHeight, this.options);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y, viewportWidth, stripHeight);
      ctx.clip();
      ctx.drawImage(state.image, baseX - cameraDeltaX * factor, drawY, drawWidth, drawHeight);
      ctx.restore();
    }
  }

  dispose(): void { this.imageState = undefined; }

  private getImage(src: string): ImageState {
    if (this.imageState) return this.imageState;
    if (typeof Image === 'undefined') {
      this.imageState = { image: null, failed: true };
      return this.imageState;
    }
    const state: ImageState = { image: new Image(), failed: false };
    state.image!.onerror = () => { state.failed = true; };
    state.image!.src = src;
    this.imageState = state;
    return state;
  }
}

export class FreshStageRenderer extends DepthPanoramaStageRenderer {
  constructor() {
    super({ fallbackColor: '#65bff0', farCameraFactor: 0.12, transitionStart: 0.48, transitionEnd: 0.62 });
  }
}

export function resolveFreshDepthCameraFactor(viewportY: number): number {
  return resolveDepthCameraFactor(viewportY, { fallbackColor: '#65bff0', farCameraFactor: 0.12, transitionStart: 0.48, transitionEnd: 0.62 });
}

export function resolveDepthCameraFactor(viewportY: number, options: DepthPanoramaOptions): number {
  if (viewportY <= options.transitionStart) return options.farCameraFactor;
  if (viewportY >= options.transitionEnd) return 1;
  const progress = (viewportY - options.transitionStart) / (options.transitionEnd - options.transitionStart);
  const eased = progress * progress * (3 - 2 * progress);
  return options.farCameraFactor + (1 - options.farCameraFactor) * eased;
}
