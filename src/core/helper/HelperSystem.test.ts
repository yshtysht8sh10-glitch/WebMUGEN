import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { countHelpers, createInitialHelperState, destroyHelper, spawnHelper, stepHelpers } from './HelperSystem';

describe('Phase60 HelperSystem', () => {
  const player = createInitialGameState().players[0];

  it('spawns and destroys helpers', () => {
    const state = spawnHelper(createInitialHelperState(), player, 1, {
      id: 1000,
      stateNo: 3000,
      x: 10,
      y: -20,
    });

    expect(countHelpers(state)).toBe(1);
    expect(state.helpers[0]).toMatchObject({
      id: 1000,
      ownerId: 1,
      stateNo: 3000,
      x: player.x + 10,
      y: player.y - 20,
    });

    expect(countHelpers(destroyHelper(state, 1000))).toBe(0);
  });

  it('expires helpers by lifetime', () => {
    const state = spawnHelper(createInitialHelperState(), player, 1, {
      stateNo: 3000,
      lifeTime: 1,
    });

    expect(stepHelpers(state).helpers).toHaveLength(0);
  });
});
