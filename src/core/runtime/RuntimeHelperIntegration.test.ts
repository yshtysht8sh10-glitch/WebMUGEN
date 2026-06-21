import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { createInitialHelperState } from '../helper/HelperSystem';
import { applyHelperRuntimeEvents } from './RuntimeHelperIntegration';

describe('Phase65 RuntimeHelperIntegration', () => {
  it('applies helper spawn and destroy events', () => {
    const game = createInitialGameState();
    const spawned = applyHelperRuntimeEvents(createInitialHelperState(), [
      { type: 'helper', id: 1000, ownerId: 1, stateNo: 3000, x: 10, y: -20, lifeTime: null },
    ], game.players);

    expect(spawned.helpers).toHaveLength(1);
    expect(spawned.helpers[0]).toMatchObject({ id: 1000, ownerId: 1, stateNo: 3000 });

    const destroyed = applyHelperRuntimeEvents(spawned, [{ type: 'destroyHelper', id: 1000 }], game.players);
    expect(destroyed.helpers).toHaveLength(0);
  });
});
