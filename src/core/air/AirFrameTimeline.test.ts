import { describe, expect, it } from 'vitest';
import { getAirAnimationDuration, selectAirFrame, type AirAnimation } from './AirFrameTimeline';

describe('Phase82 AirFrameTimeline', () => {
  const animation: AirAnimation = {
    actionNo: 200,
    frames: [
      { group: 0, image: 0, x: 0, y: 0, duration: 2 },
      { group: 0, image: 1, x: 4, y: -2, duration: 3 },
    ],
  };

  it('selects frames by animation time', () => {
    expect(getAirAnimationDuration(animation)).toBe(5);
    expect(selectAirFrame(animation, 0)?.frameIndex).toBe(0);
    expect(selectAirFrame(animation, 2)?.frameIndex).toBe(1);
    expect(selectAirFrame(animation, 5)?.frameIndex).toBe(0);
  });

  it('clamps to the last frame for non-looping animations', () => {
    const selected = selectAirFrame(animation, 99, false);
    expect(selected?.frameIndex).toBe(1);
    expect(selected?.elapsedInFrame).toBe(2);
  });
});
