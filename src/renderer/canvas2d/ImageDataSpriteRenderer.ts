import type { ImageDataSpritePack } from '../../core/sprite/ImageDataSpriteTypes';
import { spriteKey } from '../../core/sprite/SpritePackLoader';
import type { AfterImageState, BgPalFxState } from '../../core/engine/types';
import { applyPalFxToRgba } from '../../core/palfx/BgPalFxSystem';
import { applyAfterImagePaletteToRgba } from '../../core/afterimage/AfterImageSystem';

export type AfterImagePixelEffect = {
  palette: AfterImageState['palette'];
  historyIndex: number;
};

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
    diagnosticsEnabled = true,
    palFx?: BgPalFxState,
    afterImage?: AfterImagePixelEffect,
  ): { canvas: HTMLCanvasElement; diagnostic: string } | undefined {
    if (!spritePack) return undefined;
    let assetId = this.assetIds.get(spritePack);
    if (!assetId) {
      assetId = this.nextAssetId;
      this.nextAssetId += 1;
      this.assetIds.set(spritePack, assetId);
    }
    const spriteId = spriteKey(groupNo, imageNo);
    const sprite = spritePack.sprites.get(spriteId);
    if (!sprite) return undefined;
    const effectKey = palFx
      ? `;palfx=${palFx.elapsedTime}:${palFx.color}:${palFx.invertAll ? 1 : 0}:${palFx.add.red},${palFx.add.green},${palFx.add.blue}:${palFx.multiply.red},${palFx.multiply.green},${palFx.multiply.blue}:${palFx.sinAdd.red},${palFx.sinAdd.green},${palFx.sinAdd.blue},${palFx.sinAdd.period}`
      : afterImage ? `;afterimage=${afterImage.historyIndex}` : '';
    const key = `asset=${assetId};sprite=${spriteId};palette=${sprite.paletteKey ?? 'baked-rgba'};ownpal=${ownPalette ? 1 : 0}${effectKey}`;
    const cached = this.canvasCache.get(key);
    let diagnostic = '';
    if (diagnosticsEnabled) {
      let stats = this.colorStats.get(sprite.imageData);
      if (!stats) {
        stats = getColorStats(sprite.imageData.data);
        this.colorStats.set(sprite.imageData, stats);
      }
      diagnostic = `${key.replace(/;/g, ' ')} rgba_nontransparent=${stats.nonTransparent} rgba_nonblack=${stats.nonBlack} cache=${cached ? 'hit' : 'miss'}`;
    }
    if (cached) return { canvas: cached, diagnostic };

    const canvas = document.createElement('canvas');
    canvas.width = sprite.imageData.width;
    canvas.height = sprite.imageData.height;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    if (palFx || afterImage) {
      const transformed = context.createImageData(sprite.imageData.width, sprite.imageData.height);
      transformed.data.set(sprite.imageData.data);
      if (palFx) applyPalFxToRgba(transformed.data, palFx);
      if (afterImage) applyAfterImagePaletteToRgba(transformed.data, afterImage.palette, afterImage.historyIndex);
      context.putImageData(transformed, 0, 0);
    } else {
      context.putImageData(sprite.imageData, 0, 0);
    }
    if (!palFx && !afterImage) this.canvasCache.set(key, canvas);
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
