import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { getAnimationLength, getCurrentAnimationElement } from './AnimationPlayer';

describe('AnimationPlayer', () => {
  it('returns current animation element', () => {
    const air = parseAirText(`
Begin Action 20
20,0, 0,0, 5
20,1, 0,0, 5
`);

    expect(getCurrentAnimationElement(air, 20, 0)?.element.imageNo).toBe(0);
    expect(getCurrentAnimationElement(air, 20, 5)?.element.imageNo).toBe(1);
  });

  it('loops action when time exceeds length', () => {
    const air = parseAirText(`
Begin Action 0
0,0, 0,0, 5
0,1, 0,0, 5
`);

    expect(getAnimationLength(air, 0)).toBe(10);
    expect(getCurrentAnimationElement(air, 0, 191)?.element.imageNo).toBe(0);
  });

  it('keeps the last element at the exact terminal frame before default looping', () => {
    const air = parseAirText(`
Begin Action 210
210,0, 0,0, 5
210,1, 0,0, 5
`);

    expect(getAnimationLength(air, 210)).toBe(10);
    expect(getCurrentAnimationElement(air, 210, 9)?.element.imageNo).toBe(1);
    expect(getCurrentAnimationElement(air, 210, 10)?.element.imageNo).toBe(1);
    expect(getCurrentAnimationElement(air, 210, 11)?.element.imageNo).toBe(0);
  });

  it('supports LoopStart', () => {
    const air = parseAirText(`
Begin Action 10
10,0, 0,0, 5
LoopStart
10,1, 0,0, 5
10,2, 0,0, 5
`);

    expect(getCurrentAnimationElement(air, 10, 0)?.element.imageNo).toBe(0);
    expect(getCurrentAnimationElement(air, 10, 5)?.element.imageNo).toBe(1);
    expect(getCurrentAnimationElement(air, 10, 15)?.element.imageNo).toBe(1);
  });

  it('keeps duration -1 element forever', () => {
    const air = parseAirText(`
Begin Action 5000
5000,0, 0,0, 5
5000,1, 0,0, -1
`);

    expect(getAnimationLength(air, 5000)).toBe(Number.POSITIVE_INFINITY);
    expect(getCurrentAnimationElement(air, 5000, 500)?.element.imageNo).toBe(1);
  });

  it('returns null for missing action', () => {
    const air = parseAirText(`
Begin Action 0
0,0, 0,0, 5
`);

    expect(getCurrentAnimationElement(air, 999, 0)).toBeNull();
  });
});
