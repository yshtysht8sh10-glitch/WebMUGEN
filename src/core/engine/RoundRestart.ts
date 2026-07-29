import { createInitialGameState } from './GameState';
import { DEFAULT_MAX_POWER } from '../power/PowerGauge';
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

export function restartRound(
  currentRoundNo: number,
  timer?: number,
  powerMax: number = DEFAULT_MAX_POWER,
  playerStartX?: readonly [number, number],
): RoundRuntimeState {
  return {
    gameState: createInitialGameState(powerMax, {}, playerStartX),
    roundState: {
      ...createInitialRoundState(timer),
      roundNo: currentRoundNo + 1,
    },
    hitFeedbackState: createInitialHitFeedbackState(),
  };
}

export function restartCurrentRound(
  currentRoundNo: number,
  timer?: number,
  powerMax: number = DEFAULT_MAX_POWER,
  playerStartX?: readonly [number, number],
): RoundRuntimeState {
  return restartRound(currentRoundNo - 1, timer, powerMax, playerStartX);
}

export function canRestartRound(roundState: RoundState): boolean {
  return roundState.phase === 'ko' || roundState.phase === 'timeOver';
}
