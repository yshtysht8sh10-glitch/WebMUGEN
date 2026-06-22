import { describe, expect, it } from 'vitest';
import { parseDefPaletteEntries, resolvePaletteFile } from '../def/DefPaletteResolver';
import { applyPaletteToIndexedSprite } from '../render/IndexedPaletteRenderer';
import { createTestActPalette } from './ActPaletteFixture';
import { createPaletteBank, getSelectedPalette, selectPaletteSlot } from './PaletteBank';

describe('Phase81 ACT palette integration fixture', () => {
  it('resolves DEF palette selection and renders indexed pixels', () => {
    const entries = parseDefPaletteEntries('pal1 = default.act');
    const selectedFile = resolvePaletteFile(entries, 1);
    const palette = createTestActPalette();
    const bank = selectPaletteSlot(createPaletteBank([{ slot: 1, name: selectedFile ?? 'default.act', palette }]), 1);
    const selected = getSelectedPalette(bank);

    expect(selected).not.toBeNull();

    const image = applyPaletteToIndexedSprite({
      width: 2,
      height: 1,
      pixels: new Uint8Array([1, 3]),
    }, selected!);

    expect(Array.from(image.data)).toEqual([
      255, 0, 0, 255,
      0, 0, 255, 255,
    ]);
  });
});
