import { describe, expect, it } from 'vitest';
import { getPaletteColor, parseActPalette, serializeActPalette } from './ActPalette';

describe('Phase77 ActPalette', () => {
  it('parses RGB triplets and applies transparent index', () => {
    const palette = parseActPalette(new Uint8Array([
      1, 2, 3,
      10, 20, 30,
    ]), { transparentIndex: 0 });

    expect(palette.colors).toEqual([
      { r: 1, g: 2, b: 3, a: 0 },
      { r: 10, g: 20, b: 30, a: 255 },
    ]);
  });

  it('supports BGR triplets for imported indexed sources', () => {
    const palette = parseActPalette(new Uint8Array([3, 2, 1]), {
      channelOrder: 'bgr',
      transparentIndex: null,
    });

    expect(getPaletteColor(palette, 0)).toEqual({ r: 1, g: 2, b: 3, a: 255 });
  });

  it('serializes palettes back to triplets', () => {
    const palette = parseActPalette(new Uint8Array([1, 2, 3]), { transparentIndex: null });
    expect(Array.from(serializeActPalette(palette))).toEqual([1, 2, 3]);
    expect(Array.from(serializeActPalette(palette, 'bgr'))).toEqual([3, 2, 1]);
  });
});
