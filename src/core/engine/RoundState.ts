import type { GameState } from './types';

export type RoundPhase = 'intro' | 'fight' | 'ko' | 'timeOver';

export type RoundState = {
  phase: RoundPhase;
  roundNo: number;
  timer: number;
  frameInPhase: number;
  winner: 1 | 2 | 'draw' | null;
};

export function createInitialRoundState(): RoundState {
  return {
    phase: 'fight',
    roundNo: 1,
    timer: 99,
    frameInPhase: 0,
    winner: null,
  };
}

export function stepRoundState(round: RoundState, gameState: GameState): RoundState {
  if (round.phase === 'ko' || round.phase === 'timeOver') {
    return {
      ...round,
      frameInPhase: round.frameInPhase + 1,
    };
  }

  const koWinner = getKoWinner(gameState);
  if (koWinner !== null) {
    return {
      ...round,
      phase: 'ko',
      frameInPhase: 0,
      winner: koWinner,
    };
  }

  const nextFrameInPhase = round.frameInPhase + 1;
  const shouldTickTimer = nextFrameInPhase % 60 === 0;
  const nextTimer = shouldTickTimer ? Math.max(0, round.timer - 1) : round.timer;

  if (nextTimer === 0) {
    return {
      ...round,
      phase: 'timeOver',
      timer: 0,
      frameInPhase: 0,
      winner: getTimeOverWinner(gameState),
    };
  }

  return {
    ...round,
    timer: nextTimer,
    frameInPhase: nextFrameInPhase,
  };
}

function getKoWinner(gameState: GameState): 1 | 2 | 'draw' | null {
  const [p1, p2] = gameState.players;
  const p1Dead = p1.life <= 0;
  const p2Dead = p2.life <= 0;

  if (p1Dead && p2Dead) return 'draw';
  if (p1Dead) return 2;
  if (p2Dead) return 1;
  return null;
}

function getTimeOverWinner(gameState: GameState): 1 | 2 | 'draw' {
  const [p1, p2] = gameState.players;

  if (p1.life > p2.life) return 1;
  if (p2.life > p1.life) return 2;
  return 'draw';
}

export function formatRoundState(round: RoundState): string {
  const winner =
    round.winner === null
      ? '-'
      : round.winner === 'draw'
        ? 'draw'
        : `p${round.winner}`;

  return `round=${round.roundNo} phase=${round.phase} timer=${round.timer} winner=${winner}`;
}
