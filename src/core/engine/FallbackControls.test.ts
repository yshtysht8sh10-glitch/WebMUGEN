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

  it('starts fallback attack', () => {
    const state = createInitialGameState();
    const next = applyFallbackControls(
      state,
      { left: false, right: false, up: false, down: false, attack: true },
      { left: false, right: false, up: false, down: false, attack: false },
    );

    expect(next.players[0].stateNo).toBe(200);
    expect(next.players[0].moveType).toBe('A');
  });

  it('starts fallback projectile state', () => {
    const state = createInitialGameState();
    const next = applyFallbackControls(
      state,
      { left: false, right: false, up: false, down: true, attack: true, projectile: true },
      { left: false, right: false, up: false, down: false, attack: false },
    );

    expect(next.players[0].stateNo).toBe(1000);
  });
});
