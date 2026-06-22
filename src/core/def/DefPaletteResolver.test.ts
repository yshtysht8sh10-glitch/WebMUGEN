import { describe, expect, it } from 'vitest';
import { parseDefPaletteEntries, resolvePaletteFile } from './DefPaletteResolver';

describe('Phase80 DefPaletteResolver', () => {
  it('parses pal entries from DEF text', () => {
    const entries = parseDefPaletteEntries(`
      [Files]
      pal2 = "palettes\\\\blue.act"
      pal1 = palettes/default.act ; comment
    `);

    expect(entries).toEqual([
      { slot: 1, file: 'palettes/default.act' },
      { slot: 2, file: 'palettes/blue.act' },
    ]);
  });

  it('falls back to first palette when requested slot is missing', () => {
    const entries = parseDefPaletteEntries('pal1 = default.act');
    expect(resolvePaletteFile(entries, 2)).toBe('default.act');
  });

  it('collapses duplicate separators after normalizing backslashes', () => {
    const entries = parseDefPaletteEntries('pal1 = palettes//extra\\\\red.act');
    expect(entries).toEqual([{ slot: 1, file: 'palettes/extra/red.act' }]);
  });
});
