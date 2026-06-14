import { describe, expect, it } from 'vitest';
import type { AirDocument } from '../../parser/air/AirTypes';
import { calculateMugenAnimTime, getAnimationDuration } from './AnimationDuration';

describe('AnimationDuration', () => {
  const air: AirDocument = {
    actions: [
      {
        actionNo: 200,
        elements: [
          { group: 200, image: 0, x: 0, y: 0, duration: 3 },
          { group: 200, image: 1, x: 0, y: 0, duration: 4 },
        ],
        clsn2Default: [],
        elementsWithCollision: [],
      },
    ],
  };

  it('calculates action duration', () => {
    expect(getAnimationDuration(air, 200)).toBe(7);
    expect(getAnimationDuration(air, 999)).toBeNull();
  });

  it('calculates MUGEN-like AnimTime as remaining frames', () => {
    expect(calculateMugenAnimTime(0, 7)).toBe(7);
    expect(calculateMugenAnimTime(6, 7)).toBe(1);
    expect(calculateMugenAnimTime(7, 7)).toBe(0);
    expect(calculateMugenAnimTime(10, 7)).toBe(0);
  });

  it('falls back to elapsed anim time when duration is unknown', () => {
    expect(calculateMugenAnimTime(5, null)).toBe(5);
  });
});
