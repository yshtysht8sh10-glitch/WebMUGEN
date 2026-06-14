import type { RoundState } from './RoundState';

export type RoundScore = {
  p1Wins: number;
  p2Wins: number;
  draws: number;
  lastCountedRoundNo: number | null;
};

export function createInitialRoundScore(): RoundScore {
  return {
    p1Wins: 0,
    p2Wins: 0,
    draws: 0,
    lastCountedRoundNo: null,
  };
}

export function updateRoundScore(score: RoundScore, round: RoundState): RoundScore {
  if (round.phase !== 'ko' && round.phase !== 'timeOver') {
    return score;
  }

  if (round.winner === null) {
    return score;
  }

  if (score.lastCountedRoundNo === round.roundNo) {
    return score;
  }

  if (round.winner === 'draw') {
    return {
      ...score,
      draws: score.draws + 1,
      lastCountedRoundNo: round.roundNo,
    };
  }

  if (round.winner === 1) {
    return {
      ...score,
      p1Wins: score.p1Wins + 1,
      lastCountedRoundNo: round.roundNo,
    };
  }

  return {
    ...score,
    p2Wins: score.p2Wins + 1,
    lastCountedRoundNo: round.roundNo,
  };
}

export function formatRoundScore(score: RoundScore): string {
  return `score p1=${score.p1Wins} p2=${score.p2Wins} draw=${score.draws}`;
}
