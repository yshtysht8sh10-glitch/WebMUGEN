import type { CnsDocument, CnsStateDefinition } from '../../mugen/common/cnsTypes';
import type { GameState, PlayerState } from '../engine/types';
import { clampPlayerToGround, DEFAULT_GROUND_Y } from '../engine/GroundClamp';

const AIR_GRAVITY = 0.6;
const GROUND_FRICTION = 0.82;
const COMMON_JUMP_AIR_STATES = new Set([40, 50, 51]);
const COMMON_JUMP_LAND_STATE = 52;

export function stepCnsPhysicsMotion(state: GameState, cnsDocument?: CnsDocument | null): GameState {
  const movedPlayers = [
    stepPlayerCnsPhysics(state.players[0]),
    stepPlayerCnsPhysics(state.players[1]),
  ] as [PlayerState, PlayerState];

  return {
    ...state,
    frame: state.frame + 1,
    players: [
      clampPlayerAfterCnsPhysics(movedPlayers[0], cnsDocument),
      clampPlayerAfterCnsPhysics(movedPlayers[1], cnsDocument),
    ],
  };
}

function stepPlayerCnsPhysics(player: PlayerState): PlayerState {
  if (player.hitPause > 0) {
    return {
      ...player,
      hitPause: Math.max(0, player.hitPause - 1),
    };
  }

  const airborne = player.stateType === 'A' || player.physics === 'A';
  const nextVy = airborne ? player.vy + AIR_GRAVITY : player.vy;
  const nextVx = airborne ? player.vx : player.vx * GROUND_FRICTION;

  return {
    ...player,
    x: player.x + player.vx,
    y: player.y + nextVy,
    vx: Math.abs(nextVx) < 0.01 ? 0 : nextVx,
    vy: nextVy,
    stateTime: player.stateTime + 1,
    animTime: player.animTime + 1,
  };
}

function clampPlayerAfterCnsPhysics(
  player: PlayerState,
  cnsDocument?: CnsDocument | null,
): PlayerState {
  if (player.y < DEFAULT_GROUND_Y) {
    return player;
  }

  const landedFromCommonJump = COMMON_JUMP_AIR_STATES.has(player.stateNo)
    && (player.stateType === 'A' || player.physics === 'A')
    && player.vy >= 0;

  if (landedFromCommonJump && cnsDocument) {
    const landingState = findStateDefinition(cnsDocument, COMMON_JUMP_LAND_STATE);
    if (landingState) {
      return applyStateDefHeader(
        {
          ...player,
          y: DEFAULT_GROUND_Y,
          vy: 0,
          stateNo: COMMON_JUMP_LAND_STATE,
          stateTime: 0,
          animTime: 0,
        },
        landingState,
      );
    }
  }

  return clampPlayerToGround(player, DEFAULT_GROUND_Y);
}

function findStateDefinition(
  document: CnsDocument,
  stateNo: number,
): CnsStateDefinition | undefined {
  return document.states.find((state) => state.stateNo === stateNo);
}

function applyStateDefHeader(player: PlayerState, state: CnsStateDefinition): PlayerState {
  return {
    ...player,
    stateType: normalizeStateType(state.stateType, player.stateType),
    moveType: normalizeMoveType(state.moveType, player.moveType),
    physics: normalizePhysics(state.physics, player.physics),
    ctrl: state.ctrl ?? player.ctrl,
    animNo: state.initialAnim ?? player.animNo,
  };
}

function normalizeStateType(value: string | undefined, fallback: PlayerState['stateType']): PlayerState['stateType'] {
  if (value === 'S' || value === 'C' || value === 'A' || value === 'L') return value;
  return fallback;
}

function normalizeMoveType(value: string | undefined, fallback: PlayerState['moveType']): PlayerState['moveType'] {
  if (value === 'I' || value === 'A' || value === 'H') return value;
  return fallback;
}

function normalizePhysics(value: string | undefined, fallback: PlayerState['physics']): PlayerState['physics'] {
  if (value === 'S' || value === 'C' || value === 'A' || value === 'N') return value;
  return fallback;
}
