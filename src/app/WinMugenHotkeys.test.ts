import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../core/engine/GameState';
import { createInitialRoundState } from '../core/engine/RoundState';
import {
  applyWinMugenStateActions,
  isWinMugenSystemKey,
  resolveWinMugenHotkey,
  shouldPreserveNativeTextCopy,
} from './WinMugenHotkeys';

describe('WinMUGEN hotkeys', () => {
  it.each([
    [{ code: 'F1' }, 'ko-p2'],
    [{ code: 'F1', ctrlKey: true }, 'ko-p1'],
    [{ code: 'F2' }, 'life-one-both'],
    [{ code: 'F2', ctrlKey: true }, 'life-one-p1'],
    [{ code: 'F2', shiftKey: true }, 'life-one-p2'],
    [{ code: 'F3' }, 'power-full'],
    [{ code: 'F4' }, 'restart-round'],
    [{ code: 'F4', shiftKey: true }, 'reload-match'],
    [{ code: 'F5' }, 'time-over'],
    [{ code: 'F8' }, 'clear-debug'],
    [{ code: 'F12' }, 'screenshot'],
    [{ code: 'KeyC', ctrlKey: true }, 'toggle-collision-boxes'],
    [{ code: 'KeyD', ctrlKey: true }, 'toggle-debug-display'],
    [{ code: 'KeyI', ctrlKey: true }, 'force-neutral'],
    [{ code: 'KeyL', ctrlKey: true }, 'toggle-hud'],
    [{ code: 'KeyS', ctrlKey: true }, 'toggle-fast-forward'],
    [{ code: 'Space' }, 'restore-all'],
    [{ code: 'Pause' }, 'toggle-pause'],
    [{ code: 'ScrollLock' }, 'frame-step'],
  ] as const)('maps %o to %s', (event, action) => {
    expect(resolveWinMugenHotkey(event)).toBe(action);
  });

  it('ignores repeats, unsupported modifier combinations, and player-slot shortcuts', () => {
    expect(resolveWinMugenHotkey({ code: 'F4', repeat: true })).toBeNull();
    expect(resolveWinMugenHotkey({ code: 'F3', ctrlKey: true })).toBeNull();
    expect(resolveWinMugenHotkey({ code: 'Digit1', ctrlKey: true })).toBeNull();
    expect(resolveWinMugenHotkey({ code: 'Digit1', ctrlKey: true, altKey: true })).toBeNull();
  });

  it('preserves the native copy shortcut when text is selected', () => {
    expect(shouldPreserveNativeTextCopy({ code: 'KeyC', ctrlKey: true }, 'selected source')).toBe(true);
    expect(shouldPreserveNativeTextCopy({ code: 'KeyC', metaKey: true }, 'selected source')).toBe(true);
    expect(shouldPreserveNativeTextCopy({ code: 'KeyC', ctrlKey: true }, '')).toBe(false);
    expect(shouldPreserveNativeTextCopy({ code: 'KeyD', ctrlKey: true }, 'selected source')).toBe(false);
  });

  it('identifies system keys that must not skip the round presentation', () => {
    expect(isWinMugenSystemKey('F4')).toBe(true);
    expect(isWinMugenSystemKey('Space')).toBe(true);
    expect(isWinMugenSystemKey('ControlLeft')).toBe(true);
    expect(isWinMugenSystemKey('KeyA')).toBe(false);
  });

  it('applies life, power, timer, and time-over actions to runtime state', () => {
    const initialState = createInitialGameState(9000);
    const initialRound = { ...createInitialRoundState(60), phase: 'fight' as const, timer: 12 };
    const restored = applyWinMugenStateActions(initialState, initialRound, ['ko-p2', 'power-full', 'restore-all'], 60);
    expect(restored.state.players.map((player) => [player.life, player.power])).toEqual([[1000, 9000], [1000, 9000]]);
    expect(restored.roundState.timer).toBe(60);

    const timedOut = applyWinMugenStateActions(
      { ...initialState, players: [{ ...initialState.players[0], life: 800 }, { ...initialState.players[1], life: 200 }] },
      initialRound,
      ['time-over'],
      60,
    );
    expect(timedOut.roundState).toMatchObject({ phase: 'timeOver', timer: 0, winner: 1 });
  });

  it('forces roots and helpers to State 0 with control disabled', () => {
    const initialState = createInitialGameState();
    const activePlayer = { ...initialState.players[0], stateNo: 200, stateTime: 8, ctrl: true, vx: 4 };
    const state = {
      ...initialState,
      players: [activePlayer, initialState.players[1]] as typeof initialState.players,
      helpers: {
        entries: [{
          entityId: 3,
          helperId: 10,
          rootEntityId: 1 as const,
          parentEntityId: 1,
          ownerCharacterId: 1 as const,
          stateOwnerId: 1 as const,
          animationOwnerId: 1 as const,
          keyCtrl: false,
          ownPal: false,
          spawnFrame: 0,
          player: { ...activePlayer, id: 1 as const },
        }],
        nextEntityId: 4,
      },
    };
    const result = applyWinMugenStateActions(state, createInitialRoundState(), ['force-neutral'], 99);
    expect(result.state.players[0]).toMatchObject({ stateNo: 0, prevStateNo: 200, ctrl: false, vx: 0 });
    expect(result.state.helpers.entries[0].player).toMatchObject({ stateNo: 0, prevStateNo: 200, ctrl: false });
  });
});
