import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { applyFallbackStageRules } from './FallbackStageRules';

describe('FallbackStageRules', () => {
  it('makes players face each other', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 700 },
        { ...state.players[1], x: 300 },
      ],
    });

    expect(next.players[0].facing).toBe(-1);
    expect(next.players[1].facing).toBe(1);
  });

  it('clamps players to stage bounds', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: -999 },
        { ...state.players[1], x: 9999 },
      ],
    });

    expect(next.players[0].x).toBeGreaterThanOrEqual(48);
    expect(next.players[1].x).toBeLessThanOrEqual(912);
  });

  it('pushes overlapping players apart', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 300 },
        { ...state.players[1], x: 320 },
      ],
    });

    expect(next.players[1].x - next.players[0].x).toBeGreaterThanOrEqual(44);
  });
});
