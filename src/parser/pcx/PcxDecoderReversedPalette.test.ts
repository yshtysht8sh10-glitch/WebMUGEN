import { describe, expect, it } from 'vitest';
import { decodePcx } from './PcxDecoder';
import { createFake8BitPcx } from './PcxTestFixtures';

describe('PcxDecoder reversed palette index order', () => {
  it('keeps normal palette index order by default', () => {
    const image = decodePcx(createFake8BitPcx());
    expect(Array.from(image.rgbaPixels)).toEqual([
      10, 20, 30, 0,
      40, 50, 60, 255,
    ]);
  });

  it('can read palette colors using reversed MUGEN/SFF index order', () => {
    const image = decodePcx(createFake8BitPcx(), { paletteIndexOrder: 'reversed' });
    expect(Array.from(image.rgbaPixels)).toEqual([
      90, 100, 110, 0,
      70, 80, 90, 255,
    ]);
  });
});
