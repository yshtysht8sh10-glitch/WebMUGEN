import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { stepFallbackMotion } from './FallbackMotionStep';

describe('FallbackMotionStep', () => {
  it('increments frame and timers', () => {
    const state = createInitialGameState();
    const next = stepFallbackMotion(state);

    expect(next.frame).toBe(state.frame + 1);
    expect(next.players[0].animTime).toBe(state.players[0].animTime + 1);
    expect(next.players[0].stateTime).toBe(state.players[0].stateTime + 1);
  });

  it('moves player by velocity', () => {
    const state = createInitialGameState();
    const next = stepFallbackMotion({
      ...state,
      players: [
        { ...state.players[0], vx: 2, vy: -1 },
        state.players[1],
      ],
    });

    expect(next.players[0].x).toBe(state.players[0].x + 2);
    expect(next.players[0].y).toBe(state.players[0].y - 1);
  });

  it('does not force active attack back to stand', () => {
    const state = createInitialGameState();
    const next = stepFallbackMotion({
      ...state,
      players: [
        { ...state.players[0], stateNo: 200, moveType: 'A', ctrl: false, stateTime: 0, vx: 0 },
        state.players[1],
      ],
    });

    expect(next.players[0].stateNo).toBe(200);
    expect(next.players[0].moveType).toBe('A');
    expect(next.players[0].ctrl).toBe(false);
    expect(next.players[0].stateTime).toBe(1);
  });

  it('counts down hit pause without moving', () => {
    const state = createInitialGameState();
    const next = stepFallbackMotion({
      ...state,
      players: [
        { ...state.players[0], hitPause: 2, vx: 10 },
        state.players[1],
      ],
    });

    expect(next.players[0].hitPause).toBe(1);
    expect(next.players[0].x).toBe(state.players[0].x);
  });
});
