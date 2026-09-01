import { describe, expect, it } from 'vitest';
import { detectSffFormat } from '../SffFormatDetector';
import { getSffV2SpriteData, parseSffV2, resolveSffV2LinkedSprite, resolveSffV2Palette } from './SffV2Parser';
import { decodeSffV2Rle8 } from './SffV2Rle8';
import { createSffV2Fixture } from './SffV2TestFixture';

describe('SffV2Parser', () => {
  it('detects and parses an independent SFF v2 header, LData, palette, RLE8, and link', () => {
    const buffer = createSffV2Fixture();
    expect(detectSffFormat(buffer)).toEqual({ format: 'SFF_V2', version: '2.0.0.0', parser: 'SffV2Parser' });
    const document = parseSffV2(buffer);
    expect(document.header).toMatchObject({ spriteCount: 2, paletteCount: 1, ldataOffset: 584, tdataLength: 0 });
    expect(resolveSffV2LinkedSprite(document, document.sprites[1]).index).toBe(0);
    expect(resolveSffV2Palette(document, 0).bytes.slice(0, 8)).toEqual(new Uint8Array([0, 0, 0, 0, 255, 32, 16, 255]));
    expect(decodeSffV2Rle8(getSffV2SpriteData(document, document.sprites[0]), 4)).toEqual(new Uint8Array([1, 1, 1, 1]));
  });

  it('rejects linked cycles and unsupported TData explicitly', () => {
    const document = parseSffV2(createSffV2Fixture());
    document.sprites[0].dataLength = 0; document.sprites[0].linkedIndex = 1;
    expect(() => resolveSffV2LinkedSprite(document, document.sprites[0])).toThrow('cycle');
    const tdata = parseSffV2(createSffV2Fixture()); tdata.sprites[0].flags = 1;
    expect(() => getSffV2SpriteData(tdata, tdata.sprites[0])).toThrow('TData');
  });
});
