export type PauseState = {
  pauseTime: number;
  superPauseTime: number;
  darken: boolean;
  moveTime: number;
};

export function createInitialPauseState(): PauseState {
  return {
    pauseTime: 0,
    superPauseTime: 0,
    darken: false,
    moveTime: 0,
  };
}

export function startPause(state: PauseState, time: number, moveTime: number = 0): PauseState {
  return {
    ...state,
    pauseTime: Math.max(state.pauseTime, Math.max(0, time)),
    moveTime: Math.max(state.moveTime, Math.max(0, moveTime)),
  };
}

export function startSuperPause(
  state: PauseState,
  time: number,
  options: { darken?: boolean; moveTime?: number } = {},
): PauseState {
  return {
    ...state,
    superPauseTime: Math.max(state.superPauseTime, Math.max(0, time)),
    darken: options.darken ?? true,
    moveTime: Math.max(state.moveTime, Math.max(0, options.moveTime ?? 0)),
  };
}

export function stepPauseState(state: PauseState): PauseState {
  const nextPauseTime = Math.max(0, state.pauseTime - 1);
  const nextSuperPauseTime = Math.max(0, state.superPauseTime - 1);
  const nextMoveTime = Math.max(0, state.moveTime - 1);

  return {
    pauseTime: nextPauseTime,
    superPauseTime: nextSuperPauseTime,
    moveTime: nextMoveTime,
    darken: nextSuperPauseTime > 0 ? state.darken : false,
  };
}

export function isGamePaused(state: PauseState): boolean {
  return state.pauseTime > 0 || state.superPauseTime > 0;
}

export function canPlayerMoveDuringPause(state: PauseState): boolean {
  return state.moveTime > 0;
}
