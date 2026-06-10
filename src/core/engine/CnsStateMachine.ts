import type { CnsDocument, CnsStateDefinition } from '../../mugen/common/cnsTypes';
import type { PlayerInput, PlayerState } from './types';
import { executeControllers } from './ControllerExecutor';

export type StepPlayerByCnsContext = {
  input: PlayerInput;
  animLength: number;
  moveHit: boolean;
};

const GROUND_Y = 285;

export function stepPlayerByCns(
  player: PlayerState,
  document: CnsDocument,
  context: StepPlayerByCnsContext,
): PlayerState {
  const state = findStateDefinition(document, player.stateNo);

  let nextPlayer = player;
  let changedState = false;

  if (state !== undefined) {
    nextPlayer = applyStateDefDefaults(nextPlayer, state);

    const result = executeControllers(nextPlayer, state.controllers, {
      input: context.input,
      animLength: context.animLength,
      moveHit: context.moveHit,
    });

    nextPlayer = result.player;
    changedState = result.changedState;
  }

  // ChangeStateしたフレームでは、新しいStateの time = 0 を次フレームに残す。
  // これをしないと、遷移先Stateの trigger1 = time = 0 が一度も成立しない。
  if (changedState) {
    const nextState = findStateDefinition(document, nextPlayer.stateNo);
    if (nextState !== undefined) {
      nextPlayer = applyStateDefDefaults(nextPlayer, nextState);
    }

    return {
      ...nextPlayer,
      stateTime: 0,
      animTime: 0,
    };
  }

  nextPlayer = applyVelocity(nextPlayer);
  nextPlayer = clampToStage(nextPlayer);

  return {
    ...nextPlayer,
    stateTime: nextPlayer.stateTime + 1,
    animTime: nextPlayer.animTime + 1,
  };
}

export function findStateDefinition(
  document: CnsDocument,
  stateNo: number,
): CnsStateDefinition | undefined {
  return document.states.find((state) => state.stateNo === stateNo);
}

function applyStateDefDefaults(
  player: PlayerState,
  state: CnsStateDefinition,
): PlayerState {
  return {
    ...player,
    stateType: normalizeStateType(state.stateType, player.stateType),
    moveType: normalizeMoveType(state.moveType, player.moveType),
    physics: normalizePhysics(state.physics, player.physics),
    ctrl: state.ctrl ?? player.ctrl,
    animNo: state.initialAnim ?? player.animNo,
  };
}

function applyVelocity(player: PlayerState): PlayerState {
  return {
    ...player,
    x: player.x + player.vx,
    y: player.y + player.vy,
  };
}

function clampToStage(player: PlayerState): PlayerState {
  const clampedY = Math.max(0, Math.min(GROUND_Y, player.y));

  return {
    ...player,
    x: Math.max(20, Math.min(620, player.x)),
    y: clampedY,
    vy: clampedY >= GROUND_Y && player.vy > 0 ? 0 : player.vy,
  };
}

function normalizeStateType(
  value: string | undefined,
  fallback: PlayerState['stateType'],
): PlayerState['stateType'] {
  if (value === 'S' || value === 'C' || value === 'A' || value === 'L') {
    return value;
  }

  return fallback;
}

function normalizeMoveType(
  value: string | undefined,
  fallback: PlayerState['moveType'],
): PlayerState['moveType'] {
  if (value === 'I' || value === 'A' || value === 'H') {
    return value;
  }

  return fallback;
}

function normalizePhysics(
  value: string | undefined,
  fallback: PlayerState['physics'],
): PlayerState['physics'] {
  if (value === 'S' || value === 'C' || value === 'A' || value === 'N') {
    return value;
  }

  return fallback;
}
