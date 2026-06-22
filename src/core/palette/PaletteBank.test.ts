import { describe, expect, it } from 'vitest';
import { parseActPalette } from './ActPalette';
import { createPaletteBank, getPaletteBySlot, getSelectedPalette, selectPaletteSlot, setPaletteSlot } from './PaletteBank';

describe('Phase78 PaletteBank', () => {
  it('stores palette slots and selects active palette', () => {
    const pal1 = parseActPalette(new Uint8Array([1, 2, 3]));
    const pal2 = parseActPalette(new Uint8Array([10, 20, 30]));
    const bank = selectPaletteSlot(createPaletteBank([
      { slot: 1, name: 'pal1.act', palette: pal1 },
      { slot: 2, name: 'pal2.act', palette: pal2 },
    ]), 2);

    expect(getSelectedPalette(bank)).toBe(pal2);
    expect(getPaletteBySlot(bank, 1)).toBe(pal1);
  });

  it('replaces an existing slot', () => {
    const pal1 = parseActPalette(new Uint8Array([1, 2, 3]));
    const pal2 = parseActPalette(new Uint8Array([10, 20, 30]));
    const bank = setPaletteSlot(createPaletteBank([{ slot: 1, name: 'old.act', palette: pal1 }]), {
      slot: 1,
      name: 'new.act',
      palette: pal2,
    });

    expect(bank.slots).toHaveLength(1);
    expect(bank.slots[0].name).toBe('new.act');
  });
});
