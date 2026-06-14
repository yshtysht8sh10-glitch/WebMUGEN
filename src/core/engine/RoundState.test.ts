import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import {
  createInitialRoundState,
  formatRoundState,
  stepRoundState,
} from './RoundState';

function fightRound() {
  return { ...createInitialRoundState(), phase: 'fight' as const, frameInPhase: 0 };
}

describe('RoundState', () => {
  it('starts with intro phase', () => {
    expect(createInitialRoundState().phase).toBe('intro');
  });

  it('transitions from intro to fight after intro frames', () => {
    let round = createInitialRoundState();
    const gameState = createInitialGameState();

    for (let i = 0; i < 90; i += 1) {
      round = stepRoundState(round, gameState);
    }

    expect(round.phase).toBe('fight');
    expect(round.frameInPhase).toBe(0);
  });

  it('counts timer every 60 fight frames', () => {
    let round = fightRound();
    const gameState = createInitialGameState();

    for (let i = 0; i < 60; i += 1) {
      round = stepRoundState(round, gameState);
    }

    expect(round.timer).toBe(98);
    expect(round.phase).toBe('fight');
  });

  it('enters KO phase when P2 life reaches zero', () => {
    const gameState = createInitialGameState();
    const round = stepRoundState(fightRound(), {
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
    const round = stepRoundState(fightRound(), {
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
    let round = { ...fightRound(), timer: 1 };
    const gameState = createInitialGameState();

    for (let i = 0; i < 60; i += 1) {
      round = stepRoundState(round, gameState);
    }

    expect(round.phase).toBe('timeOver');
    expect(round.winner).toBe('draw');
  });

  it('formats round state', () => {
    expect(formatRoundState(createInitialRoundState())).toContain('phase=intro');
  });
});
