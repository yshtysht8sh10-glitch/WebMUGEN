import { describe, expect, it } from 'vitest';
import { findSprite, spriteKey } from './SpritePackLoader';
import type { SpritePack } from './SpriteTypes';

describe('SpritePackLoader', () => {
  it('creates sprite key', () => {
    expect(spriteKey(200, 2)).toBe('200,2');
  });

  it('finds sprite by group and image number', () => {
    const fakeImage = {} as HTMLImageElement;
    const pack: SpritePack = {
      sprites: new Map([
        [
          '200,2',
          {
            groupNo: 200,
            imageNo: 2,
            src: 'debug/200_2.png',
            xAxis: 16,
            yAxis: 78,
            image: fakeImage,
          },
        ],
      ]),
    };

    expect(findSprite(pack, 200, 2)?.image).toBe(fakeImage);
    expect(findSprite(pack, 200, 3)).toBeUndefined();
  });
});
