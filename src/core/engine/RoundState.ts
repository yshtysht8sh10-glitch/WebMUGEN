import type { GameState } from './types';

export type RoundPhase = 'intro' | 'fight' | 'ko' | 'timeOver';

export type RoundState = {
  phase: RoundPhase;
  roundNo: number;
  timer: number;
  frameInPhase: number;
  winner: 1 | 2 | 'draw' | null;
  endReason?: 'ko' | 'double_ko' | 'time_over';
};

export const DEFAULT_ROUND_TIMER = 99;

export function createInitialRoundState(timer: number = DEFAULT_ROUND_TIMER): RoundState {
  return {
    phase: 'intro',
    roundNo: 1,
    timer,
    frameInPhase: 0,
    winner: null,
  };
}

export function stepRoundState(round: RoundState, gameState: GameState, freezeTimer: boolean = false): RoundState {
  if (round.phase === 'intro') {
    const nextFrameInPhase = round.frameInPhase + 1;
    const introActive = gameState.players.some((player) => (
      player.stateNo >= 190 && player.stateNo <= 199
    ) || player.assertSpecialFlags?.some((flag) => flag.toLowerCase() === 'intro'));

    if (!introActive) {
      return {
        ...round,
        phase: 'fight',
        frameInPhase: 0,
      };
    }

    return {
      ...round,
      frameInPhase: nextFrameInPhase,
    };
  }

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
      endReason: koWinner === 'draw' ? 'double_ko' : 'ko',
    };
  }

  const nextFrameInPhase = round.frameInPhase + 1;
  const shouldTickTimer = !freezeTimer && nextFrameInPhase % 60 === 0;
  const nextTimer = shouldTickTimer ? Math.max(0, round.timer - 1) : round.timer;

  if (nextTimer === 0) {
    return {
      ...round,
      phase: 'timeOver',
      timer: 0,
      frameInPhase: 0,
      winner: getTimeOverWinner(gameState),
      endReason: 'time_over',
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

  return `round=${round.roundNo} phase=${round.phase} timer=${round.timer} winner=${winner} roundEndRequested=${round.phase === 'ko' || round.phase === 'timeOver' ? 1 : 0} roundEndReason=${round.endReason ?? '-'}`;
}
