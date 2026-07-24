import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { spawnHelper } from '../helper/HelperSystem';
import {
  canPlayerMoveDuringPause,
  createInitialPauseState,
  isGamePaused,
  restorePausedEntityPhysics,
  startPause,
  startSuperPause,
  stepPauseState,
} from './PauseSystem';

describe('Phase57 PauseSystem', () => {
  it('starts and steps normal pause', () => {
    const paused = startPause(createInitialPauseState(), 2);
    expect(isGamePaused(paused)).toBe(true);

    const once = stepPauseState(paused);
    expect(once.pauseTime).toBe(1);

    const twice = stepPauseState(once);
    expect(isGamePaused(twice)).toBe(false);
  });

  it('starts super pause with darken and movetime', () => {
    const paused = startSuperPause(createInitialPauseState(), 3, { darken: true, moveTime: 2 });
    expect(paused.superPauseTime).toBe(3);
    expect(paused.darken).toBe(true);
    expect(canPlayerMoveDuringPause(paused)).toBe(true);

    const stepped = stepPauseState(stepPauseState(paused));
    expect(stepped.moveTime).toBe(0);
    expect(stepped.superPauseTime).toBe(1);
  });

  it('restores non-owner root and Helper physics while preserving the exact moving entity', () => {
    const initial = createInitialGameState();
    const helpers = spawnHelper(initial.helpers, {
      helperId: 10, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 100, x: 100, y: 0,
      facing: 1, keyCtrl: false, ownPal: false, spawnFrame: 0, parent: initial.players[0],
    });
    const before = { ...initial, helpers };
    const after = {
      ...before,
      players: before.players.map((player) => ({ ...player, x: player.x + 10, stateTime: player.stateTime + 1 })) as typeof before.players,
      helpers: {
        ...helpers,
        entries: helpers.entries.map((helper) => ({
          ...helper,
          player: { ...helper.player, x: helper.player.x + 10, stateTime: helper.player.stateTime + 1 },
        })),
      },
    };

    const helperMoves = restorePausedEntityPhysics(before, after, startPause(createInitialPauseState(), 2, 1, 3));
    expect(helperMoves.players.map((player) => player.x)).toEqual(before.players.map((player) => player.x));
    expect(helperMoves.helpers.entries[0].player.x).toBe(110);

    const rootMoves = restorePausedEntityPhysics(before, after, startSuperPause(createInitialPauseState(), 2, { moveTime: 1, ownerEntityId: 1 }));
    expect(rootMoves.players[0].x).toBe(before.players[0].x + 10);
    expect(rootMoves.players[1].x).toBe(before.players[1].x);
    expect(rootMoves.helpers.entries[0].player.x).toBe(100);
  });
});
