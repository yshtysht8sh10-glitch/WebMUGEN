import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { getAttackBox, getBodyBox, resolveSimpleHits } from './SimpleCollision';

describe('SimpleCollision', () => {
  it('creates body and attack boxes', () => {
    const player = {
      ...createInitialGameState().players[0],
      stateNo: 200,
      animTime: 6,
    };

    expect(getBodyBox(player).width).toBeGreaterThan(0);
    expect(getAttackBox(player).width).toBeGreaterThan(0);
  });

  it('deals damage when attack box overlaps opponent body box', () => {
    const state = createInitialGameState();
    const p1 = {
      ...state.players[0],
      x: 220,
      stateNo: 200,
      animTime: 6,
      facing: 1 as const,
    };
    const p2 = {
      ...state.players[1],
      x: 270,
      life: 1000,
    };

    const result = resolveSimpleHits([p1, p2]);

    expect(result.hitEvents).toHaveLength(1);
    expect(result.players[1].life).toBe(950);
  });

  it('does not deal damage outside active attack frames', () => {
    const state = createInitialGameState();
    const p1 = {
      ...state.players[0],
      x: 220,
      stateNo: 200,
      animTime: 2,
      facing: 1 as const,
    };
    const p2 = {
      ...state.players[1],
      x: 270,
      life: 1000,
    };

    const result = resolveSimpleHits([p1, p2]);

    expect(result.hitEvents).toHaveLength(0);
    expect(result.players[1].life).toBe(1000);
  });
});
