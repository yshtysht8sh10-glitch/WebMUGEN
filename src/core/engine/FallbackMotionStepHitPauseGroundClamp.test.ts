import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { stepFallbackMotion } from './FallbackMotionStep';

describe('FallbackMotionStep hit pause with ground clamp', () => {
  it('counts down hit pause without moving', () => {
    const state = createInitialGameState();
    const next = stepFallbackMotion({
      ...state,
      players: [
        {
          ...state.players[0],
          hitPause: 2,
          x: 100,
          y: 240,
          vx: 5,
          vy: 5,
          stateTime: 10,
          animTime: 10,
        },
        state.players[1],
      ],
    });

    expect(next.players[0].hitPause).toBe(1);
    expect(next.players[0].x).toBe(100);
    expect(next.players[0].y).toBe(240);
    expect(next.players[0].stateTime).toBe(10);
    expect(next.players[0].animTime).toBe(10);
  });

  it('still clamps a paused player if already below ground', () => {
    const state = createInitialGameState();
    const next = stepFallbackMotion({
      ...state,
      players: [
        {
          ...state.players[0],
          hitPause: 2,
          y: 390,
          vy: 5,
          stateType: 'A',
          physics: 'A',
          ctrl: false,
        },
        state.players[1],
      ],
    });

    expect(next.players[0].hitPause).toBe(1);
    expect(next.players[0].y).toBe(285);
    expect(next.players[0].vy).toBe(0);
    expect(next.players[0].stateType).toBe('S');
    expect(next.players[0].physics).toBe('S');
    expect(next.players[0].ctrl).toBe(true);
  });
});
