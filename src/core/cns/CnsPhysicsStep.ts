import type { GameState, PlayerState } from '../engine/types';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';
import type { CnsDocument, CnsStateDefinition } from '../../mugen/common/cnsTypes';

const AIR_GRAVITY = 0.6;
const GROUND_FRICTION = 0.82;
const COMMON_JUMP_LAND_STATE = 52;

export function stepCnsPhysicsMotion(state: GameState, cns?: CnsDocument | null): GameState {
  const movedPlayers = [
    stepPlayerCnsPhysics(state.players[0]),
    stepPlayerCnsPhysics(state.players[1]),
  ] as [PlayerState, PlayerState];
  const clampedPlayers = [
    clampPlayerAfterCnsPhysics(movedPlayers[0]),
    clampPlayerAfterCnsPhysics(movedPlayers[1]),
  ] as [PlayerState, PlayerState];

  return {
    ...state,
    frame: state.frame + 1,
    players: [
      applyCnsAirLandingState(clampedPlayers[0], clampedPlayers[1], cns),
      applyCnsAirLandingState(clampedPlayers[1], clampedPlayers[0], cns),
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

  const usesAirPhysics = player.physics === 'A';
  const nextVy = usesAirPhysics ? player.vy + AIR_GRAVITY : player.vy;
  const nextVx = usesAirPhysics ? player.vx : player.vx * GROUND_FRICTION;

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

function clampPlayerAfterCnsPhysics(player: PlayerState): PlayerState {
  if (player.y < DEFAULT_GROUND_Y) {
    return player;
  }

  return {
    ...player,
    y: DEFAULT_GROUND_Y,
    vy: player.physics === 'A' && player.vy > 0 ? 0 : player.vy,
  };
}

function applyCnsAirLandingState(player: PlayerState, opponent: PlayerState, cns?: CnsDocument | null): PlayerState {
  if (!cns || player.stateNo === COMMON_JUMP_LAND_STATE || player.physics !== 'A' || player.stateType !== 'A') {
    return player;
  }

  if (player.y < DEFAULT_GROUND_Y || player.vy < 0) {
    return player;
  }

  const landingState = cns.states.find((state) => state.stateNo === COMMON_JUMP_LAND_STATE);
  if (!landingState) {
    return player;
  }

  return enterLandingState(player, opponent, landingState);
}

function enterLandingState(player: PlayerState, opponent: PlayerState, stateDef: CnsStateDefinition): PlayerState {
  const stateType = toStateType(stateDef.stateType) ?? player.stateType;
  const physics = toPhysics(stateDef.physics) ?? player.physics;
  const animNo = stateDef.initialAnim ?? player.animNo;

  return {
    ...player,
    prevStateNo: player.stateNo,
    stateNo: stateDef.stateNo,
    stateTime: 0,
    stateType,
    moveType: toMoveType(stateDef.moveType) ?? player.moveType,
    physics,
    ctrl: stateDef.ctrl ?? player.ctrl,
    animNo,
    animTime: player.animNo === animNo ? player.animTime : 0,
    y: DEFAULT_GROUND_Y,
    vy: 0,
    activeHitDef: null,
    hitDefUsed: false,
    facing: player.x <= opponent.x ? 1 : -1,
  } as PlayerState;
}

function toStateType(value: string | undefined): PlayerState['stateType'] | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === 'S' || normalized === 'C' || normalized === 'A' || normalized === 'L' ? normalized : null;
}

function toMoveType(value: string | undefined): PlayerState['moveType'] | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === 'I' || normalized === 'A' || normalized === 'H' ? normalized : null;
}

function toPhysics(value: string | undefined): PlayerState['physics'] | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === 'S' || normalized === 'C' || normalized === 'A' || normalized === 'N' ? normalized : null;
}
