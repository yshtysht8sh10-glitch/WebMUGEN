import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseSndV1 } from '../../parser/snd/SndParser';
import { getCurrentAnimationElement } from '../animation/AnimationPlayer';
import { convertSffV1ToImageDataSpritePack } from '../sprite/SffSpritePackConverter';

class FakeImageData {
  constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
}

(globalThis as unknown as { ImageData: typeof ImageData }).ImageData = FakeImageData as unknown as typeof ImageData;

describe('T-H-M-A State 902 blocking assets', () => {
  it('keeps every first and held blocking sprite visible after SFF conversion', async () => {
    const sffBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.sff');
    const sprites = convertSffV1ToImageDataSpritePack(
      sffBytes.buffer.slice(sffBytes.byteOffset, sffBytes.byteOffset + sffBytes.byteLength) as ArrayBuffer,
    );

    for (const key of ['902,10', '902,20', '905,10', '905,20', '908,10', '908,20']) {
      const sprite = sprites.sprites.get(key);
      expect(sprite, `T-H-M-A blocking sprite ${key} is missing`).toBeDefined();
      expect(
        Array.from(sprite!.imageData.data).some((value, index) => index % 4 === 3 && value > 0),
        `T-H-M-A blocking sprite ${key} has no visible pixels`,
      ).toBe(true);
    }
  });

  it('renders the first blocking sprite on contact and follows the AIR two-frame timing', async () => {
    const airBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air');
    const air = parseAirText(new TextDecoder('shift_jis').decode(airBytes));

    for (const animNo of [902, 905, 908]) {
      expect(getCurrentAnimationElement(air, animNo, 0)?.element).toMatchObject({
        groupNo: animNo,
        imageNo: 10,
      });
      expect(getCurrentAnimationElement(air, animNo, 1)?.element).toMatchObject({
        groupNo: animNo,
        imageNo: 10,
      });
      expect(getCurrentAnimationElement(air, animNo, 2)?.element).toMatchObject({
        groupNo: animNo,
        imageNo: 20,
      });
    }
  });

  it('loads State 902 PlaySnd S900,0 as a non-empty WAVE sample', async () => {
    const sndBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.snd');
    const sounds = parseSndV1(sndBytes);
    const sample = sounds.samplesByKey.get('900,0');

    expect(sample).toMatchObject({ group: 900, index: 0, format: 'wave' });
    expect(sample!.bytes.byteLength).toBeGreaterThan(44);
  });
});
