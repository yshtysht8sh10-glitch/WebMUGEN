import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import {
  createInitialHitFeedbackState,
  getScreenShakeOffset,
  startEnvironmentShake,
  updateHitFeedback,
} from './HitFeedback';

describe('HitFeedback', () => {
  it('creates hit spark from hit event', () => {
    const gameState = {
      ...createInitialGameState(),
      hitEvents: [{ attackerId: 1 as const, defenderId: 2 as const, damage: 60 }],
    };

    const feedback = updateHitFeedback(createInitialHitFeedbackState(), gameState);

    expect(feedback.sparks).toHaveLength(1);
    expect(feedback.sparks[0]).toMatchObject({
      attackerId: 1,
      defenderId: 2,
      damage: 60,
      life: 18,
    });
  });

  it('decays hit sparks', () => {
    const initial = {
      sparks: [{ id: 1, x: 100, y: 100, life: 2, attackerId: 1 as const, defenderId: 2 as const, damage: 60 }],
      nextSparkId: 2,
    };

    const feedback = updateHitFeedback({ ...initial, sparks: initial.sparks }, createInitialGameState());

    expect(feedback.sparks[0].life).toBe(1);
  });

  it('removes expired hit sparks', () => {
    const initial = {
      sparks: [{ id: 1, x: 100, y: 100, life: 1, attackerId: 1 as const, defenderId: 2 as const, damage: 60 }],
      nextSparkId: 2,
    };

    const feedback = updateHitFeedback(initial, createInitialGameState());

    expect(feedback.sparks).toHaveLength(0);
  });

  it('uses requested spark coordinates, skips missing sparks, and exposes sound/shake effects', () => {
    const gameState = {
      ...createInitialGameState(),
      hitEvents: [
        {
          attackerId: 1 as const, defenderId: 2 as const, damage: 10,
          spark: { animNo: 5001, scope: 'attacker' as const, x: 300, y: 220, coordinateSpace: 'stage' as const, available: true },
          sound: { group: 1, index: 2, scope: 'attacker' as const },
          envShake: { time: 4, frequency: 90, amplitude: -4, phase: 90 },
        },
        {
          attackerId: 1 as const, defenderId: 2 as const, damage: 10,
          spark: { animNo: 9999, scope: 'attacker' as const, x: 0, y: 0, coordinateSpace: 'stage' as const, available: false },
        },
      ],
    };
    const feedback = updateHitFeedback(createInitialHitFeedbackState(), gameState);
    expect(feedback.sparks).toHaveLength(1);
    expect(feedback.sparks[0]).toMatchObject({ x: 300, y: 220, animNo: 5001, scope: 'attacker' });
    expect(feedback.soundCues).toEqual([{ group: 1, index: 2, scope: 'attacker' }]);
    expect(feedback.shake).toMatchObject({ remaining: 4, elapsed: 0 });
    expect(getScreenShakeOffset(feedback).y).toBeCloseTo(-4);

    const decayed = updateHitFeedback(feedback, createInitialGameState());
    expect(decayed.shake).toMatchObject({ remaining: 3, elapsed: 1 });
  });

  it('starts a controller-driven environment shake in the shared feedback state', () => {
    const feedback = startEnvironmentShake(createInitialHitFeedbackState(), { time: 5, frequency: 80, amplitude: -6, phase: 30 });
    expect(feedback.shake).toEqual({ time: 5, frequency: 80, amplitude: -6, phase: 30, remaining: 5, elapsed: 0 });
  });
});
