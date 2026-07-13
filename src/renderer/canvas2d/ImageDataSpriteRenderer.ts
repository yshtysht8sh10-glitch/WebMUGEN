import type { ImageDataSpritePack } from '../../core/sprite/ImageDataSpriteTypes';
import { spriteKey } from '../../core/sprite/SpritePackLoader';

export class ImageDataSpriteRenderer {
  private readonly canvasCache = new Map<string, HTMLCanvasElement>();
  private readonly assetIds = new WeakMap<ImageDataSpritePack, number>();
  private readonly colorStats = new WeakMap<ImageData, { nonTransparent: number; nonBlack: number }>();
  private nextAssetId = 1;

  resolveCanvas(
    spritePack: ImageDataSpritePack | null | undefined,
    groupNo: number,
    imageNo: number,
    ownPalette = false,
  ): { canvas: HTMLCanvasElement; diagnostic: string } | undefined {
    if (!spritePack) return undefined;
    let assetId = this.assetIds.get(spritePack);
    if (!assetId) {
      assetId = this.nextAssetId;
      this.nextAssetId += 1;
      this.assetIds.set(spritePack, assetId);
    }
    const spriteId = spriteKey(groupNo, imageNo);
    const key = `asset=${assetId};sprite=${spriteId};palette=baked-rgba;ownpal=${ownPalette ? 1 : 0}`;
    const cached = this.canvasCache.get(key);
    const sprite = spritePack.sprites.get(spriteId);
    if (!sprite) return undefined;
    let stats = this.colorStats.get(sprite.imageData);
    if (!stats) {
      stats = getColorStats(sprite.imageData.data);
      this.colorStats.set(sprite.imageData, stats);
    }
    const diagnostic = `${key.replace(/;/g, ' ')} rgba_nontransparent=${stats.nonTransparent} rgba_nonblack=${stats.nonBlack} cache=${cached ? 'hit' : 'miss'}`;
    if (cached) return { canvas: cached, diagnostic };

    const canvas = document.createElement('canvas');
    canvas.width = sprite.imageData.width;
    canvas.height = sprite.imageData.height;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    context.putImageData(sprite.imageData, 0, 0);
    this.canvasCache.set(key, canvas);
    return { canvas, diagnostic };
  }

  findCanvas(
    spritePack: ImageDataSpritePack | null | undefined,
    groupNo: number,
    imageNo: number,
    ownPalette = false,
  ): HTMLCanvasElement | undefined {
    return this.resolveCanvas(spritePack, groupNo, imageNo, ownPalette)?.canvas;
  }

  clear(): void {
    this.canvasCache.clear();
  }
}

function getColorStats(data: Uint8ClampedArray): { nonTransparent: number; nonBlack: number } {
  let nonTransparent = 0;
  let nonBlack = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    nonTransparent += 1;
    if (data[index] !== 0 || data[index + 1] !== 0 || data[index + 2] !== 0) nonBlack += 1;
  }
  return { nonTransparent, nonBlack };
}
