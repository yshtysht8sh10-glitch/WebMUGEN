import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import {
  createInitialRoundState,
  formatRoundState,
  stepRoundState,
} from './RoundState';

describe('RoundState', () => {
  it('counts timer every 60 frames', () => {
    let round = createInitialRoundState();
    const gameState = createInitialGameState();

    for (let i = 0; i < 60; i += 1) {
      round = stepRoundState(round, gameState);
    }

    expect(round.timer).toBe(98);
    expect(round.phase).toBe('fight');
  });

  it('enters KO phase when P2 life reaches zero', () => {
    const gameState = createInitialGameState();
    const round = stepRoundState(createInitialRoundState(), {
      ...gameState,
      players: [
        gameState.players[0],
        { ...gameState.players[1], life: 0 },
      ],
    });

    expect(round.phase).toBe('ko');
    expect(round.winner).toBe(1);
  });

  it('detects draw KO', () => {
    const gameState = createInitialGameState();
    const round = stepRoundState(createInitialRoundState(), {
      ...gameState,
      players: [
        { ...gameState.players[0], life: 0 },
        { ...gameState.players[1], life: 0 },
      ],
    });

    expect(round.phase).toBe('ko');
    expect(round.winner).toBe('draw');
  });

  it('enters timeOver when timer reaches zero', () => {
    let round = { ...createInitialRoundState(), timer: 1 };
    const gameState = createInitialGameState();

    for (let i = 0; i < 60; i += 1) {
      round = stepRoundState(round, gameState);
    }

    expect(round.phase).toBe('timeOver');
    expect(round.winner).toBe('draw');
  });

  it('formats round state', () => {
    expect(formatRoundState(createInitialRoundState())).toContain('phase=fight');
  });
});
