import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { clampPlayerToGround, clampPlayersToGround, DEFAULT_GROUND_Y } from './GroundClamp';

describe('GroundClamp', () => {
  it('uses the stage floor top as the default ground y', () => {
    expect(DEFAULT_GROUND_Y).toBe(285);
  });

  it('does not change a player above the ground', () => {
    const state = createInitialGameState();
    const player = { ...state.players[0], y: 300, vy: 5, stateType: 'A' as const, physics: 'A' as const };

    expect(clampPlayerToGround(player, 360)).toEqual(player);
  });

  it('clamps a falling airborne player to ground', () => {
    const state = createInitialGameState();
    const player = {
      ...state.players[0],
      y: 390,
      vy: 7,
      stateType: 'A' as const,
      physics: 'A' as const,
      ctrl: false,
    };

    expect(clampPlayerToGround(player, 360)).toMatchObject({
      y: 360,
      vy: 0,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
    });
  });

  it('keeps grounded state but still clamps y and vy', () => {
    const state = createInitialGameState();
    const player = {
      ...state.players[0],
      y: 380,
      vy: 2,
      stateType: 'S' as const,
      physics: 'S' as const,
      ctrl: true,
    };

    expect(clampPlayerToGround(player, 360)).toMatchObject({
      y: 360,
      vy: 0,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
    });
  });

  it('clamps both players', () => {
    const state = createInitialGameState();
    const result = clampPlayersToGround(
      {
        ...state,
        players: [
          { ...state.players[0], y: 500, vy: 3, stateType: 'A', physics: 'A', ctrl: false },
          { ...state.players[1], y: 361, vy: 1, stateType: 'S', physics: 'S' },
        ],
      },
      360,
    );

    expect(result.players[0].y).toBe(360);
    expect(result.players[1].y).toBe(360);
  });
});
