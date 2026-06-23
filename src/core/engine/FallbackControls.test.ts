import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { applyFallbackControls } from './FallbackControls';

describe('FallbackControls', () => {
  it('moves P1 with fallback controls', () => {
    const state = createInitialGameState();
    const next = applyFallbackControls(
      state,
      { left: false, right: true, up: false, down: false, attack: false },
      { left: false, right: false, up: false, down: false, attack: false },
    );

    expect(next.players[0].stateNo).toBe(20);
    expect(next.players[0].animNo).toBe(20);
    expect(next.players[0].vx).toBeGreaterThan(0);
  });

  it('uses back-walk animation when moving backward', () => {
    const state = createInitialGameState();
    const next = applyFallbackControls(
      state,
      { left: true, right: false, up: false, down: false, attack: false },
      { left: false, right: false, up: false, down: false, attack: false },
    );

    expect(next.players[0].stateNo).toBe(20);
    expect(next.players[0].animNo).toBe(21);
    expect(next.players[0].vx).toBeLessThan(0);
  });

  it('crouches while holding down', () => {
    const state = createInitialGameState();
    const next = applyFallbackControls(
      state,
      { left: false, right: false, up: false, down: true, attack: false },
      { left: false, right: false, up: false, down: false, attack: false },
    );

    expect(next.players[0]).toMatchObject({
      stateNo: 11,
      animNo: 11,
      stateType: 'C',
      physics: 'C',
      vx: 0,
    });
  });

  it('preserves crouch timers while down is held', () => {
    const state = createInitialGameState();
    const next = applyFallbackControls(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 11, animNo: 11, stateType: 'C', physics: 'C', animTime: 8, stateTime: 8 },
          state.players[1],
        ],
      },
      { left: false, right: false, up: false, down: true, attack: false },
      { left: false, right: false, up: false, down: false, attack: false },
    );

    expect(next.players[0].animTime).toBe(8);
    expect(next.players[0].stateTime).toBe(8);
  });

  it('does not start attack directly from fallback controls', () => {
    const state = createInitialGameState();
    const next = applyFallbackControls(
      state,
      { left: false, right: false, up: false, down: false, attack: true },
      { left: false, right: false, up: false, down: false, attack: false },
    );

    expect(next.players[0].stateNo).toBe(0);
    expect(next.players[0].moveType).toBe('I');
  });

  it('does not interrupt active attack', () => {
    const state = createInitialGameState();
    const next = applyFallbackControls(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 200, moveType: 'A', ctrl: false, stateTime: 5 },
          state.players[1],
        ],
      },
      { left: true, right: false, up: false, down: false, attack: false },
      { left: false, right: false, up: false, down: false, attack: false },
    );

    expect(next.players[0].stateNo).toBe(200);
    expect(next.players[0].stateTime).toBe(5);
  });

  it('jumps with fallback controls', () => {
    const state = createInitialGameState();
    const next = applyFallbackControls(
      state,
      { left: false, right: false, up: true, down: false, attack: false },
      { left: false, right: false, up: false, down: false, attack: false },
    );

    expect(next.players[0].stateNo).toBe(40);
    expect(next.players[0].stateType).toBe('A');
  });

  it('does not force idle or walk while the player is physically airborne', () => {
    const state = createInitialGameState();
    const next = applyFallbackControls(
      {
        ...state,
        players: [
          { ...state.players[0], y: 240, stateNo: 40, animNo: 40, stateType: 'S', physics: 'A', ctrl: true },
          state.players[1],
        ],
      },
      { left: false, right: true, up: false, down: false, attack: false },
      { left: false, right: false, up: false, down: false, attack: false },
    );

    expect(next.players[0].stateNo).toBe(40);
    expect(next.players[0].animNo).toBe(40);
    expect(next.players[0].y).toBe(240);
  });
});
