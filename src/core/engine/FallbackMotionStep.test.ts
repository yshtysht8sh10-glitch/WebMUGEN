import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { applyFallbackControls } from './FallbackControls';
import { stepFallbackMotion } from './FallbackMotionStep';

describe('FallbackMotionStep', () => {
  it('increments frame and animation time', () => {
    const state = createInitialGameState();
    const next = stepFallbackMotion(state);

    expect(next.frame).toBe(state.frame + 1);
    expect(next.players[0].animTime).toBe(state.players[0].animTime + 1);
  });

  it('moves walking player', () => {
    const state = applyFallbackControls(
      createInitialGameState(),
      { left: false, right: true, up: false, down: false, attack: false },
      { left: false, right: false, up: false, down: false, attack: false },
    );

    const next = stepFallbackMotion(state);

    expect(next.players[0].x).toBeGreaterThan(state.players[0].x);
  });

  it('lands airborne player', () => {
    let state = createInitialGameState();
    state = {
      ...state,
      players: [
        {
          ...state.players[0],
          y: 284,
          vy: 3,
          stateType: 'A',
          physics: 'A',
          stateNo: 40,
          animNo: 40,
        },
        state.players[1],
      ],
    };

    const next = stepFallbackMotion(state);

    expect(next.players[0].y).toBe(285);
    expect(next.players[0].stateNo).toBe(0);
    expect(next.players[0].ctrl).toBe(true);
  });

  it('returns attack player to idle after action finishes', () => {
    let state = applyFallbackControls(
      createInitialGameState(),
      { left: false, right: false, up: false, down: false, attack: true },
      { left: false, right: false, up: false, down: false, attack: false },
    );

    for (let i = 0; i < 20; i += 1) {
      state = stepFallbackMotion(state);
    }

    expect(state.players[0].stateNo).toBe(0);
    expect(state.players[0].ctrl).toBe(true);
  });
});
