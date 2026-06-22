import { getPaletteColor, type ActPalette } from '../palette/ActPalette';

export type IndexedSprite = {
  width: number;
  height: number;
  pixels: Uint8Array;
};

export function applyPaletteToIndexedSprite(sprite: IndexedSprite, palette: ActPalette): ImageDataLike {
  const expectedLength = sprite.width * sprite.height;

  if (sprite.pixels.length !== expectedLength) {
    throw new Error(`Indexed sprite pixel length mismatch: expected ${expectedLength}, got ${sprite.pixels.length}`);
  }

  const data = new Uint8ClampedArray(expectedLength * 4);

  sprite.pixels.forEach((paletteIndex, pixelIndex) => {
    const color = getPaletteColor(palette, paletteIndex);
    const offset = pixelIndex * 4;
    data[offset] = color.r;
    data[offset + 1] = color.g;
    data[offset + 2] = color.b;
    data[offset + 3] = color.a;
  });

  return {
    width: sprite.width,
    height: sprite.height,
    data,
  };
}

export type ImageDataLike = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};
