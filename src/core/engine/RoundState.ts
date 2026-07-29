import type { GameState } from './types';

export type RoundPhase = 'intro' | 'fight' | 'ko' | 'timeOver';

export type RoundState = {
  phase: RoundPhase;
  roundNo: number;
  timer: number;
  frameInPhase: number;
  introPresentationFrame: number | null;
  winner: 1 | 2 | 'draw' | null;
  endReason?: 'ko' | 'double_ko' | 'time_over';
  resultStateEntered: boolean;
  resultSkipRequested: boolean;
};

export const DEFAULT_ROUND_TIMER = 99;
export const ROUND_INTRO_PRESENTATION_FRAMES = 90;

export function createInitialRoundState(timer: number = DEFAULT_ROUND_TIMER): RoundState {
  return {
    phase: 'intro',
    roundNo: 1,
    timer,
    frameInPhase: 0,
    introPresentationFrame: null,
    winner: null,
    resultStateEntered: false,
    resultSkipRequested: false,
  };
}

export function stepRoundState(round: RoundState, gameState: GameState, freezeTimer: boolean = false): RoundState {
  if (round.phase === 'intro') {
    const nextFrameInPhase = round.frameInPhase + 1;
    const introActive = gameState.players.some((player) => (
      player.stateNo >= 190 && player.stateNo <= 199
    ) || player.assertSpecialFlags?.some((flag) => flag.toLowerCase() === 'intro'));

    const presentationFrame = round.introPresentationFrame;
    if (!introActive && presentationFrame === null) {
      return {
        ...round,
        frameInPhase: nextFrameInPhase,
        introPresentationFrame: 0,
      };
    }

    if (!introActive && presentationFrame !== null) {
      const nextPresentationFrame = presentationFrame + 1;
      if (nextPresentationFrame >= ROUND_INTRO_PRESENTATION_FRAMES) {
        return {
          ...round,
          phase: 'fight',
          frameInPhase: 0,
          introPresentationFrame: null,
        };
      }
      return {
        ...round,
        frameInPhase: nextFrameInPhase,
        introPresentationFrame: nextPresentationFrame,
      };
    }

    return {
      ...round,
      frameInPhase: nextFrameInPhase,
      introPresentationFrame: null,
    };
  }

  if (round.phase === 'ko' || round.phase === 'timeOver') {
    const resultStateEntered = round.resultStateEntered || hasEnteredResultState(round, gameState);
    return {
      ...round,
      resultStateEntered,
      frameInPhase: resultStateEntered ? round.frameInPhase + 1 : round.frameInPhase,
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
      resultStateEntered: false,
      resultSkipRequested: false,
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
      resultStateEntered: false,
      resultSkipRequested: false,
    };
  }

  return {
    ...round,
    timer: nextTimer,
    frameInPhase: nextFrameInPhase,
  };
}

export function forceRoundTimeOver(round: RoundState, gameState: GameState): RoundState {
  if (round.phase !== 'fight') return round;
  return {
    ...round,
    phase: 'timeOver',
    timer: 0,
    frameInPhase: 0,
    winner: getTimeOverWinner(gameState),
    endReason: 'time_over',
    resultStateEntered: false,
    resultSkipRequested: false,
  };
}

function hasEnteredResultState(round: RoundState, gameState: GameState): boolean {
  const [p1, p2] = gameState.players;
  if (round.phase === 'ko') {
    if (round.winner === 'draw') return p1.stateNo === 5150 && p2.stateNo === 5150;
    const winner = round.winner === 1 ? p1 : p2;
    return winner.stateNo >= 180 && winner.stateNo <= 189;
  }
  if (round.phase === 'timeOver') {
    if (round.winner === 'draw') return [p1, p2].every((player) => player.stateNo >= 175 && player.stateNo <= 179);
    const winner = round.winner === 1 ? p1 : p2;
    const loser = round.winner === 1 ? p2 : p1;
    return winner.stateNo >= 180 && winner.stateNo <= 189 && loser.stateNo >= 170 && loser.stateNo <= 179;
  }
  return false;
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
