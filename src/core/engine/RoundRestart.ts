import { createInitialGameState } from './GameState';
import {
  createInitialRoundState,
  type RoundState,
} from './RoundState';
import {
  createInitialHitFeedbackState,
  type HitFeedbackState,
} from './HitFeedback';
import type { GameState } from './types';

export type RoundRuntimeState = {
  gameState: GameState;
  roundState: RoundState;
  hitFeedbackState: HitFeedbackState;
};

export function restartRound(currentRoundNo: number): RoundRuntimeState {
  return {
    gameState: createInitialGameState(),
    roundState: {
      ...createInitialRoundState(),
      roundNo: currentRoundNo + 1,
    },
    hitFeedbackState: createInitialHitFeedbackState(),
  };
}

export function canRestartRound(roundState: RoundState): boolean {
  return roundState.phase === 'ko' || roundState.phase === 'timeOver';
}
