import { describe, expect, it } from 'vitest';
import { MUGEN_1_0_PROFILE, WINMUGEN_PROFILE } from '../../compatibility/CompatibilityProfile';
import { createSffV2Fixture } from '../../parser/sff/v2/SffV2TestFixture';
import { loadSffSpritePack } from './SffSpritePackDispatcher';

class FakeImageData { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} }
(globalThis as unknown as { ImageData: typeof ImageData }).ImageData = FakeImageData as unknown as typeof ImageData;

describe('SFF sprite pack dispatch', () => {
  it('uses the actual v2 header and preserves linked sprite metadata', () => {
    const result = loadSffSpritePack(MUGEN_1_0_PROFILE, createSffV2Fixture());
    expect(result.detection.parser).toBe('SffV2Parser');
    expect(result.pack.sprites.size).toBe(2); expect(result.pack.palettes?.size).toBe(1);
    expect(result.pack.sprites.get('0,1')).toMatchObject({ xAxis: 7, yAxis: 9, paletteMetadata: { linked: true, linkedSource: 0 } });
    expect(Array.from(result.pack.sprites.get('0,0')!.imageData.data.slice(0, 4))).toEqual([255, 32, 16, 255]);
  });

  it('does not silently treat v2 as a WinMUGEN resource', () => {
    expect(() => loadSffSpritePack(WINMUGEN_PROFILE, createSffV2Fixture())).toThrow('WinMUGEN profile');
  });

  it.each([[3, 'RLE5'], [4, 'LZ5']])('rejects unsupported v2 format %i as %s', (format, name) => {
    const buffer = createSffV2Fixture();
    new DataView(buffer).setUint8(528 + 14, format);
    expect(() => loadSffSpritePack(MUGEN_1_0_PROFILE, buffer)).toThrow(name);
  });
});
