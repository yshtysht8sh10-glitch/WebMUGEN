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

  it('does not push players apart when their push boxes do not overlap vertically', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 300, y: 260, stateType: 'A' },
        { ...state.players[1], x: 300, y: 360 },
      ],
    });

    expect(next.players[0].x).toBe(300);
    expect(next.players[1].x).toBe(300);
  });

  it('allows an aerial cross-over and updates facing after players change sides', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 340, y: 260, stateType: 'A', facing: 1 },
        { ...state.players[1], x: 300, y: 360, facing: -1 },
      ],
    });

    expect(next.players[0].x).toBe(340);
    expect(next.players[1].x).toBe(300);
    expect(next.players[0].facing).toBe(-1);
    expect(next.players[1].facing).toBe(1);
  });

  it('does not push either player when PlayerPush is disabled', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 300, playerPush: false },
        { ...state.players[1], x: 320 },
      ],
    });

    expect(next.players[0].x).toBe(300);
    expect(next.players[1].x).toBe(320);
  });
});
