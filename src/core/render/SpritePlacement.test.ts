import { describe, expect, it } from 'vitest';
import { computeSpritePlacement } from './SpritePlacement';

describe('Phase83 SpritePlacement', () => {
  it('applies sprite axis and AIR frame offset', () => {
    expect(computeSpritePlacement(
      { x: 100, y: 200, facing: 1 },
      { group: 0, image: 1, x: 5, y: -10, duration: 4 },
      { width: 40, height: 60, axisX: 20, axisY: 50 },
    )).toEqual({ x: 85, y: 140, width: 40, height: 60 });
  });

  it('mirrors horizontal AIR offset when actor is facing left', () => {
    expect(computeSpritePlacement(
      { x: 100, y: 200, facing: -1 },
      { group: 0, image: 1, x: 5, y: 0, duration: 4 },
      { width: 40, height: 60, axisX: 20, axisY: 50 },
    ).x).toBe(75);
  });
});
