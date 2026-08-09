import type { StageRenderContext } from '../StageRuntime';
import type { WebMugenStageDefinition } from './WebMugenStageSchema';

type ImageState = { image: HTMLImageElement | null; failed: boolean };

export class WebMugenStageRenderer {
  private readonly images = new Map<string, ImageState>();

  render(stage: WebMugenStageDefinition, context: StageRenderContext): void {
    this.renderPass(stage, context, 'background');
  }

  renderForeground(stage: WebMugenStageDefinition, context: StageRenderContext): void {
    this.renderPass(stage, context, 'foreground');
  }

  private renderPass(stage: WebMugenStageDefinition, context: StageRenderContext, pass: 'background' | 'foreground'): void {
    const { ctx, viewportWidth, viewportHeight, cameraX, cameraY } = context;
    let drewImage = false;
    for (const layer of stage.layers.filter((candidate) => candidate.pass === pass)) {
      const state = this.getImage(layer.src);
      if (!state.image || !state.image.complete || state.image.naturalWidth === 0) continue;
      drawCover(
        ctx,
        state.image,
        viewportWidth,
        viewportHeight,
        cameraX * layer.cameraFactor[0],
        cameraY * layer.cameraFactor[1],
        layer.viewportBand,
      );
      drewImage = true;
    }
    if (pass === 'background' && !drewImage) {
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

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  viewportBand: readonly [number, number],
): void {
  const overscan = Math.max(36, Math.ceil(Math.hypot(width, height) * 0.06));
  const targetWidth = width + overscan * 2;
  const targetHeight = height + overscan * 2;
  const scale = Math.max(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, height * viewportBand[0], width, height * (viewportBand[1] - viewportBand[0]));
  ctx.clip();
  ctx.drawImage(image, (width - drawWidth) / 2 - offsetX, (height - drawHeight) / 2 - offsetY, drawWidth, drawHeight);
  ctx.restore();
}
