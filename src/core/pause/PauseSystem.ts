import type { GameState, HelperEntity, HelperRuntimeState } from '../engine/types';

export type PauseState = {
  pauseTime: number;
  superPauseTime: number;
  darken: boolean;
  moveTime: number;
  ownerEntityId: number | null;
  kind: 'pause' | 'superpause' | null;
  resumeGuard: boolean;
};

export type PauseControllerEvent = {
  type: 'pause' | 'superpause';
  ownerEntityId: number;
  time: number;
  moveTime: number;
  darken: boolean;
};

export function createInitialPauseState(): PauseState {
  return {
    pauseTime: 0,
    superPauseTime: 0,
    darken: false,
    moveTime: 0,
    ownerEntityId: null,
    kind: null,
    resumeGuard: false,
  };
}

export function startPause(state: PauseState, time: number, moveTime: number = 0, ownerEntityId: number | null = null): PauseState {
  return {
    ...state,
    pauseTime: Math.max(state.pauseTime, Math.max(0, time)),
    moveTime: Math.max(state.moveTime, Math.max(0, moveTime)),
    ownerEntityId,
    kind: 'pause',
    resumeGuard: false,
  };
}

export function startSuperPause(
  state: PauseState,
  time: number,
  options: { darken?: boolean; moveTime?: number; ownerEntityId?: number | null } = {},
): PauseState {
  return {
    ...state,
    superPauseTime: Math.max(state.superPauseTime, Math.max(0, time)),
    darken: options.darken ?? true,
    moveTime: Math.max(state.moveTime, Math.max(0, options.moveTime ?? 0)),
    ownerEntityId: options.ownerEntityId ?? null,
    kind: 'superpause',
    resumeGuard: false,
  };
}

export function stepPauseState(state: PauseState): PauseState {
  const nextPauseTime = Math.max(0, state.pauseTime - 1);
  const nextSuperPauseTime = Math.max(0, state.superPauseTime - 1);
  const nextMoveTime = Math.max(0, state.moveTime - 1);

  const wasActive = isGamePaused(state);
  const active = nextPauseTime > 0 || nextSuperPauseTime > 0;
  return {
    pauseTime: nextPauseTime,
    superPauseTime: nextSuperPauseTime,
    moveTime: nextMoveTime,
    darken: nextSuperPauseTime > 0 ? state.darken : false,
    ownerEntityId: active ? state.ownerEntityId : null,
    kind: nextSuperPauseTime > 0 ? 'superpause' : nextPauseTime > 0 ? 'pause' : null,
    resumeGuard: wasActive && !active ? true : false,
  };
}

export function isGamePaused(state: PauseState): boolean {
  return state.pauseTime > 0 || state.superPauseTime > 0;
}

export function canPlayerMoveDuringPause(state: PauseState): boolean {
  return state.moveTime > 0;
}

export function canEntityMoveDuringPause(state: PauseState, entityId: number): boolean {
  return !isGamePaused(state) || state.ownerEntityId === entityId && state.moveTime > 0;
}

export function canHelperMoveDuringPause(state: PauseState, helper: HelperEntity): boolean {
  if (canEntityMoveDuringPause(state, helper.entityId)) return true;
  return state.superPauseTime > 0 ? (helper.superMoveTime ?? 0) > 0 : (helper.pauseMoveTime ?? 0) > 0;
}

export function stepHelperPauseMoveTimes(state: HelperRuntimeState, pause: PauseState): HelperRuntimeState {
  if (!isGamePaused(pause)) return state;
  const isSuperPause = pause.superPauseTime > 0;
  return {
    ...state,
    entries: state.entries.map((helper) => isSuperPause
      ? { ...helper, superMoveTime: Math.max(0, (helper.superMoveTime ?? 0) - 1) }
      : { ...helper, pauseMoveTime: Math.max(0, (helper.pauseMoveTime ?? 0) - 1) }),
  };
}

export function restorePausedEntityPhysics(before: GameState, after: GameState, pause: PauseState): GameState {
  const beforeHelpers = new Map(before.helpers.entries.map((helper) => [helper.entityId, helper]));
  return {
    ...after,
    players: after.players.map((player, index) => canEntityMoveDuringPause(pause, player.id)
      ? player
      : before.players[index]) as GameState['players'],
    helpers: {
      ...after.helpers,
      entries: after.helpers.entries.map((helper) => {
        const previous = beforeHelpers.get(helper.entityId);
        return canHelperMoveDuringPause(pause, helper) || !previous
          ? helper
          : { ...helper, player: previous.player };
      }),
    },
  };
}

export function applyPauseControllerEvents(state: PauseState, events: readonly PauseControllerEvent[]): PauseState {
  return events.reduce((next, event) => event.type === 'pause'
    ? startPause(next, event.time, event.moveTime, event.ownerEntityId)
    : startSuperPause(next, event.time, { moveTime: event.moveTime, darken: event.darken, ownerEntityId: event.ownerEntityId }), state);
}
