import { describe, expect, it } from 'vitest';
import { createInitialRoundState } from './RoundState';
import {
  createInitialRoundScore,
  formatRoundScore,
  updateRoundScore,
} from './RoundScore';

describe('RoundScore', () => {
  it('starts with zero wins', () => {
    expect(createInitialRoundScore()).toMatchObject({
      p1Wins: 0,
      p2Wins: 0,
      draws: 0,
    });
  });

  it('counts P1 win once', () => {
    const round = {
      ...createInitialRoundState(),
      phase: 'ko' as const,
      winner: 1 as const,
    };

    let score = createInitialRoundScore();
    score = updateRoundScore(score, round);
    score = updateRoundScore(score, round);

    expect(score.p1Wins).toBe(1);
    expect(score.p2Wins).toBe(0);
  });

  it('counts P2 win', () => {
    const score = updateRoundScore(createInitialRoundScore(), {
      ...createInitialRoundState(),
      phase: 'timeOver',
      winner: 2,
    });

    expect(score.p2Wins).toBe(1);
  });

  it('counts draw', () => {
    const score = updateRoundScore(createInitialRoundScore(), {
      ...createInitialRoundState(),
      phase: 'ko',
      winner: 'draw',
    });

    expect(score.draws).toBe(1);
  });

  it('formats score', () => {
    expect(formatRoundScore(createInitialRoundScore())).toBe('score p1=0 p2=0 draw=0');
  });
});
