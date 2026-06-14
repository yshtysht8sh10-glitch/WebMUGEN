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
});
