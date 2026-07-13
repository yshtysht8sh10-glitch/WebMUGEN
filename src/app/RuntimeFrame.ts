import type { GameState } from '../core/engine/types';

export function synchronizeRuntimeFrame(state: GameState, frame: number): GameState {
  return state.frame === frame ? state : { ...state, frame };
}
