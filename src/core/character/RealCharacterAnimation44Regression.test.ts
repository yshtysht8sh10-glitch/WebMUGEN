import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { convertSffV1ToImageDataSpritePack } from '../sprite/SffSpritePackConverter';
import { parseAirText } from '../../parser/air/AirParser';
import { findSffSprite, parseSffV1 } from '../../parser/sff/SffParser';

class FakeImageData {
  constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
}

(globalThis as unknown as { ImageData: typeof ImageData }).ImageData = FakeImageData as unknown as typeof ImageData;

describe('T-H-M-A Action 44 regression', () => {
  it('parses Action 044 as 44 and resolves every referenced SFF sprite', async () => {
    const airBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air');
    const sffBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.sff');
    const air = parseAirText(new TextDecoder('shift_jis').decode(airBytes));
    const sff = parseSffV1(
      sffBytes.buffer.slice(sffBytes.byteOffset, sffBytes.byteOffset + sffBytes.byteLength) as ArrayBuffer,
    );
    const action = air.actions.find((candidate) => candidate.actionNo === 44);

    expect(action?.elements.map((element) => [element.groupNo, element.imageNo])).toEqual([
      [40, 3],
      [40, 4],
      [40, 5],
      [40, 6],
    ]);
    for (const element of action!.elements) {
      expect(findSffSprite(sff, element.groupNo, element.imageNo)).toBeDefined();
    }
  });
});

describe('T-H-M-A Action 5170 bounce regression', () => {
  it('keeps shared-palette sprite 5203,2 visible in the converted sprite pack', async () => {
    const sffBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.sff');
    const sprites = convertSffV1ToImageDataSpritePack(
      sffBytes.buffer.slice(sffBytes.byteOffset, sffBytes.byteOffset + sffBytes.byteLength) as ArrayBuffer,
    );
    const bounceSprite = sprites.sprites.get('5203,2');

    expect(bounceSprite).toBeDefined();
    expect(Array.from(bounceSprite!.imageData.data).some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
    expect(bounceSprite?.paletteMetadata).toMatchObject({
      source: 'sprite-specific-chain',
      embeddedPalette: false,
    });
  });
});
