import { describe, expect, it } from 'vitest';
import { getCollisionBoxColor, projectCollisionBoxes } from './CollisionOverlay';

describe('Phase85 CollisionOverlay', () => {
  it('projects collision boxes to screen coordinates', () => {
    expect(projectCollisionBoxes([
      { kind: 'clsn2', left: -10, top: -20, right: 15, bottom: 5 },
    ], { x: 100, y: 200 }, 1)).toEqual([
      { kind: 'clsn2', left: -10, top: -20, right: 15, bottom: 5, x: 90, y: 180, width: 25, height: 25 },
    ]);
  });

  it('mirrors collision boxes when facing left', () => {
    expect(projectCollisionBoxes([
      { kind: 'clsn1', left: -10, top: -20, right: 15, bottom: 5 },
    ], { x: 100, y: 200 }, -1)[0]).toMatchObject({ x: 85, y: 180, width: 25, height: 25 });
  });

  it('returns distinct debug colors', () => {
    expect(getCollisionBoxColor('clsn1')).not.toBe(getCollisionBoxColor('clsn2'));
  });
});
