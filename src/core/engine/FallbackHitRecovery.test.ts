import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { applyFallbackHitRecovery } from './FallbackHitRecovery';

describe('FallbackHitRecovery', () => {
  it('does not recover while hitPause remains', () => {
    const state = createInitialGameState();
    const next = applyFallbackHitRecovery({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 5000,
          animNo: 5000,
          moveType: 'H',
          ctrl: false,
          hitPause: 3,
          stateTime: 99,
        },
        state.players[1],
      ],
    });

    expect(next.players[0].stateNo).toBe(5000);
    expect(next.players[0].moveType).toBe('H');
  });

  it('does not recover before recovery frames', () => {
    const state = createInitialGameState();
    const next = applyFallbackHitRecovery({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 5000,
          animNo: 5000,
          moveType: 'H',
          ctrl: false,
          hitPause: 0,
          stateTime: 10,
        },
        state.players[1],
      ],
    });

    expect(next.players[0].stateNo).toBe(5000);
    expect(next.players[0].ctrl).toBe(false);
  });

  it('recovers hit player to idle', () => {
    const state = createInitialGameState();
    const next = applyFallbackHitRecovery({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 5000,
          animNo: 5000,
          moveType: 'H',
          ctrl: false,
          hitPause: 0,
          stateTime: 28,
          vx: 4,
          hitDefUsed: true,
        },
        state.players[1],
      ],
    });

    expect(next.players[0]).toMatchObject({
      stateNo: 0,
      animNo: 0,
      moveType: 'I',
      ctrl: true,
      vx: 0,
      hitDefUsed: false,
    });
  });
});
