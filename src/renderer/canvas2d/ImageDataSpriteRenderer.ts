import type { ImageDataSpritePack } from '../../core/sprite/ImageDataSpriteTypes';
import { spriteKey } from '../../core/sprite/SpritePackLoader';

export class ImageDataSpriteRenderer {
  private readonly canvasCache = new Map<string, HTMLCanvasElement>();

  findCanvas(
    spritePack: ImageDataSpritePack | null | undefined,
    groupNo: number,
    imageNo: number,
  ): HTMLCanvasElement | undefined {
    const key = spriteKey(groupNo, imageNo);
    const cached = this.canvasCache.get(key);
    if (cached) {
      return cached;
    }

    const sprite = spritePack?.sprites.get(key);
    if (!sprite) {
      return undefined;
    }

    const canvas = document.createElement('canvas');
    canvas.width = sprite.imageData.width;
    canvas.height = sprite.imageData.height;

    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    context.putImageData(sprite.imageData, 0, 0);
    this.canvasCache.set(key, canvas);
    return canvas;
  }

  clear(): void {
    this.canvasCache.clear();
  }
}
