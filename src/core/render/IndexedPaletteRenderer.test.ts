import { describe, expect, it } from 'vitest';
import { parseActPalette } from '../palette/ActPalette';
import { applyPaletteToIndexedSprite } from './IndexedPaletteRenderer';

describe('Phase79 IndexedPaletteRenderer', () => {
  it('converts indexed pixels to RGBA pixels', () => {
    const palette = parseActPalette(new Uint8Array([
      0, 0, 0,
      255, 0, 0,
      0, 255, 0,
    ]), { transparentIndex: 0 });

    const image = applyPaletteToIndexedSprite({
      width: 2,
      height: 2,
      pixels: new Uint8Array([0, 1, 2, 9]),
    }, palette);

    expect(Array.from(image.data)).toEqual([
      0, 0, 0, 0,
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 0, 0,
    ]);
  });
});
