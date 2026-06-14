import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import {
  createInitialHitFeedbackState,
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
});
