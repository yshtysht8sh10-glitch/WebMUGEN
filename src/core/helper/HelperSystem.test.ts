import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { countHelpers, createInitialHelperState, destroyHelper, spawnHelper, type HelperSpawnRequest } from './HelperSystem';

describe('HelperSystem entity identity', () => {
  const player = createInitialGameState().players[0];
  const request = (helperId: number, stateNo = 3000): HelperSpawnRequest => ({
    helperId, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
    stateOwnerId: 1, animationOwnerId: 1, stateNo,
    x: player.x + 10, y: player.y - 20, facing: player.facing,
    keyCtrl: false, ownPal: false, spawnFrame: 0, parent: player,
  });

  it('keeps runtime entity ID separate from duplicate MUGEN Helper IDs', () => {
    let state = spawnHelper(createInitialHelperState(), request(1000));
    state = spawnHelper(state, request(1000, 3001));

    expect(state.entries.map((entry) => entry.entityId)).toEqual([3, 4]);
    expect(state.entries.map((entry) => entry.helperId)).toEqual([1000, 1000]);
    expect(countHelpers(state, 1, 1000)).toBe(2);
    expect(state.entries[0]).toMatchObject({ rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1 });

    expect(destroyHelper(state, 3).entries.map((entry) => entry.entityId)).toEqual([4]);
  });

  it('creates an independent State/Anim/variable snapshot', () => {
    const state = spawnHelper(createInitialHelperState(), request(22, 192), {
      metadataSections: [],
      states: [{ stateNo: 192, stateType: 'A', moveType: 'I', physics: 'N', initialAnim: 3645, controllers: [] }],
    });
    expect(state.entries[0].player).toMatchObject({ stateNo: 192, stateTime: 0, animNo: 3645, animTime: 0 });
    expect((state.entries[0].player as { vars?: Record<number, number> }).vars).toEqual({});
  });
});
