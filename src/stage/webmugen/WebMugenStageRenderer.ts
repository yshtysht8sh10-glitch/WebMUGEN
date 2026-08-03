import type { StageRenderContext } from '../StageRuntime';
import type { WebMugenStageDefinition } from './WebMugenStageSchema';

type ImageState = { image: HTMLImageElement | null; failed: boolean };

export class WebMugenStageRenderer {
  private readonly images = new Map<string, ImageState>();

  render(stage: WebMugenStageDefinition, context: StageRenderContext): void {
    const { ctx, viewportWidth, viewportHeight, cameraX } = context;
    let drewImage = false;
    for (const layer of stage.layers) {
      const state = this.getImage(layer.src);
      if (!state.image || !state.image.complete || state.image.naturalWidth === 0) continue;
      drawCover(ctx, state.image, viewportWidth, viewportHeight, cameraX * layer.parallax);
      drewImage = true;
    }
    if (!drewImage) {
      ctx.fillStyle = '#030816';
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    }
  }

  dispose(): void { this.images.clear(); }

  private getImage(src: string): ImageState {
    const current = this.images.get(src);
    if (current) return current;
    if (typeof Image === 'undefined') {
      const unavailable = { image: null, failed: true };
      this.images.set(src, unavailable);
      return unavailable;
    }
    const state: ImageState = { image: new Image(), failed: false };
    state.image!.onerror = () => { state.failed = true; };
    state.image!.src = src;
    this.images.set(src, state);
    return state;
  }
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, offsetX: number): void {
  const overscan = Math.max(36, Math.ceil(Math.hypot(width, height) * 0.06));
  const targetWidth = width + overscan * 2;
  const targetHeight = height + overscan * 2;
  const scale = Math.max(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2 - offsetX, (height - drawHeight) / 2, drawWidth, drawHeight);
}
