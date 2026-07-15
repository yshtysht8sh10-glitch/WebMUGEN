import type { GameState, PlayerState } from '../engine/types';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';
import type { CnsDocument, CnsStateDefinition } from '../../mugen/common/cnsTypes';
import { readCnsConst } from './CnsConstants';

const GROUND_FRICTION = 0.82;
const COMMON_JUMP_LAND_STATE = 52;

export function stepCnsPhysicsMotion(state: GameState, cns?: CnsDocument | null): GameState {
  const movedPlayers = [
    stepPlayerCnsPhysics(state.players[0], cns),
    stepPlayerCnsPhysics(state.players[1], cns),
  ] as [PlayerState, PlayerState];
  const clampedPlayers = [
    clampPlayerAfterCnsPhysics(movedPlayers[0]),
    clampPlayerAfterCnsPhysics(movedPlayers[1]),
  ] as [PlayerState, PlayerState];

  const landedPlayers = [
    applyCnsAirLandingState(clampedPlayers[0], clampedPlayers[1], cns),
    applyCnsAirLandingState(clampedPlayers[1], clampedPlayers[0], cns),
  ] as [PlayerState, PlayerState];
  return {
    ...state,
    frame: state.frame + 1,
    helpers: {
      ...state.helpers,
      entries: state.helpers.entries.map((helper) => ({
        ...helper,
        player: helper.spawnFrame === state.frame ? helper.player : stepPlayerCnsPhysics(helper.player, cns),
      })),
    },
    players: [
      applyCommonDownRecovery(landedPlayers[0], cns, state.players[0].hitPause > 0),
      applyCommonDownRecovery(landedPlayers[1], cns, state.players[1].hitPause > 0),
    ],
  };
}

function applyCommonDownRecovery(player: PlayerState, cns: CnsDocument | null | undefined, wasHitPaused: boolean): PlayerState {
  if (player.stateNo !== 5110) {
    return player.lieDownElapsed === undefined && player.lieDownTime === undefined
      ? player
      : { ...player, lieDownElapsed: undefined, lieDownTime: undefined };
  }

  const lieDownTime = Math.max(0, Math.trunc(readCnsConst(cns, 'data.liedown.time')));
  const lieDownElapsed = (player.lieDownElapsed ?? 0) + (wasHitPaused ? 0 : 1);
  const timed = {
    ...player,
    lieDownElapsed,
    lieDownTime,
    hitDiagnosticLines: [
      ...(player.hitDiagnosticLines ?? []),
      `raw.down_clock target=p${player.id}`,
      `  state=5110 elapsed=${lieDownElapsed} duration=${lieDownTime} remaining=${Math.max(0, lieDownTime - lieDownElapsed)} hitPause=${wasHitPaused ? 1 : 0} ko=${player.life <= 0 ? 1 : 0} result=${player.life <= 0 ? 'ko_hold' : lieDownElapsed >= lieDownTime ? 'getup' : wasHitPaused ? 'frozen' : 'advance'}`,
    ],
  };
  if (player.life <= 0 || lieDownElapsed < lieDownTime) return timed;

  const getupState = cns?.states.find((stateDef) => stateDef.stateNo === 5120);
  if (!getupState) return timed;
  return {
    ...timed,
    prevStateNo: 5110,
    stateNo: 5120,
    stateTime: 0,
    stateType: toStateType(getupState.stateType) ?? 'L',
    moveType: toMoveType(getupState.moveType) ?? 'I',
    physics: toPhysics(getupState.physics) ?? 'N',
    ctrl: getupState.ctrl ?? false,
    lieDownElapsed: undefined,
    lieDownTime: undefined,
  } as PlayerState;
}

export function stepPlayerCnsPhysics(player: PlayerState, cns?: CnsDocument | null): PlayerState {
  if (player.hitPause > 0) {
    return {
      ...player,
      hitPause: Math.max(0, player.hitPause - 1),
    };
  }

  const nextTime = {
    stateTime: player.stateTime + 1,
    animTime: player.animTime + 1,
  };

  if (player.positionFrozen) {
    return { ...player, positionFrozen: false, ...nextTime };
  }

  if (player.physics === 'S' || player.physics === 'C') {
    const nextVx = player.vx * GROUND_FRICTION;
    return {
      ...player,
      x: player.x + player.vx,
      y: DEFAULT_GROUND_Y,
      vx: Math.abs(nextVx) < 0.01 ? 0 : nextVx,
      vy: 0,
      ...nextTime,
    };
  }

  if (player.physics === 'A') {
    const nextVy = player.vy + readCnsConst(cns, 'movement.yaccel');
    return {
      ...player,
      x: player.x + player.vx,
      y: player.y + nextVy,
      vy: nextVy,
      ...nextTime,
    };
  }

  // Physics=N disables the built-in gravity/friction, but explicit velocity
  // controllers still move the player on both axes.
  return {
    ...player,
    x: player.x + player.vx,
    y: player.y + player.vy,
    ...nextTime,
  };
}

function clampPlayerAfterCnsPhysics(player: PlayerState): PlayerState {
  if (player.y < DEFAULT_GROUND_Y) {
    return player;
  }

  if ((player.stateType === 'A' || player.stateType === 'L') && player.moveType === 'H') {
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
