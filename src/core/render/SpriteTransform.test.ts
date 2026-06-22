import { describe, expect, it } from 'vitest';
import { applyTransformToSize, computeSpriteTransform } from './SpriteTransform';

describe('Phase84 SpriteTransform', () => {
  it('combines AIR flip and actor facing', () => {
    const frame = { group: 0, image: 0, x: 0, y: 0, duration: 1, flipH: true };

    expect(computeSpriteTransform(frame, 1)).toMatchObject({ flipH: true, flipV: false });
    expect(computeSpriteTransform(frame, -1)).toMatchObject({ flipH: false, flipV: false });
  });

  it('applies positive render scale to size', () => {
    const transform = computeSpriteTransform({ group: 0, image: 0, x: 0, y: 0, duration: 1 }, 1, { x: 2, y: 0.5 });
    expect(applyTransformToSize(20, 40, transform)).toEqual({ width: 40, height: 20 });
  });
});
