import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { getPresentedAnimationTime, snapshotPresentedAnimation } from './PresentedAnimation';

describe('PresentedAnimation', () => {
  it('keeps the CNS-evaluated AIR time through the following physics result', () => {
    const beforePhysics = {
      ...createInitialGameState().players[0],
      stateNo: 730,
      stateTime: 29,
      animNo: 730,
      animTime: 29,
    };
    const afterPhysics = {
      ...beforePhysics,
      stateTime: 30,
      animTime: 30,
      presentedAnimation: snapshotPresentedAnimation(beforePhysics),
    };

    expect(getPresentedAnimationTime(afterPhysics)).toBe(29);
  });

  it('does not restore a snapshot after State or Anim identity changes', () => {
    const base = {
      ...createInitialGameState().players[0],
      stateNo: 730,
      stateTime: 30,
      animNo: 730,
      animTime: 30,
      presentedAnimation: { stateNo: 730, stateTime: 29, animNo: 730, animTime: 29 },
    };

    expect(getPresentedAnimationTime({ ...base, stateNo: 731 })).toBe(30);
    expect(getPresentedAnimationTime({ ...base, animNo: 731 })).toBe(30);
    expect(getPresentedAnimationTime({ ...base, stateTime: 0 })).toBe(30);
  });
});
