import type { CnsDocument, CnsStateDefinition } from '../../mugen/common/cnsTypes';
import type { PlayerInput, PlayerState } from './types';
import { executeControllers } from './ControllerExecutor';

export type StepPlayerByCnsContext = {
  input: PlayerInput;
  animLength: number;
  moveHit: boolean;
};

const GROUND_Y = 285;
const GROUND_FRICTION = 0.82;
const AIR_GRAVITY = 0.45;

export function stepPlayerByCns(
  player: PlayerState,
  document: CnsDocument,
  context: StepPlayerByCnsContext,
): PlayerState {
  if (player.hitPause > 0) {
    return {
      ...player,
      hitPause: player.hitPause - 1,
    };
  }

  const state = findStateDefinition(document, player.stateNo);

  let nextPlayer = player;
  let changedState = false;
  let velocityChanged = false;

  if (state !== undefined) {
    nextPlayer = applyStateDefDefaults(nextPlayer, state);

    const result = executeControllers(nextPlayer, state.controllers, {
      input: context.input,
      animLength: context.animLength,
      moveHit: context.moveHit,
    });

    nextPlayer = result.player;
    changedState = result.changedState;
    velocityChanged = result.velocityChanged;
  }

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

  nextPlayer = applyPhysics(nextPlayer, velocityChanged, context.input);
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

function applyPhysics(
  player: PlayerState,
  velocityChangedByController: boolean,
  input: PlayerInput,
): PlayerState {
  if (player.stateType === 'A' || player.physics === 'A' || player.y < GROUND_Y) {
    return {
      ...player,
      vy: player.vy + AIR_GRAVITY,
    };
  }

  const holdingHorizontal = input.left || input.right;

  if (
    !velocityChangedByController &&
    !holdingHorizontal &&
    (player.physics === 'S' || player.physics === 'C')
  ) {
    const vx = Math.abs(player.vx) < 0.05 ? 0 : player.vx * GROUND_FRICTION;
    return {
      ...player,
      vx,
    };
  }

  return player;
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
  const landed = clampedY >= GROUND_Y && player.vy > 0;

  return {
    ...player,
    x: Math.max(20, Math.min(620, player.x)),
    y: clampedY,
    vy: landed ? 0 : player.vy,
    stateType: landed && player.stateType === 'A' ? 'S' : player.stateType,
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
