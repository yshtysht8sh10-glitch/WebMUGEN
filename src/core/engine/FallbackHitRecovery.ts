import type { GameState, PlayerState } from './types';

const STAND_HIT_STATE = 5000;
const AIR_HIT_STATE = 5030;
const HIT_RECOVERY_FRAMES = 28;

export function applyFallbackHitRecovery(state: GameState): GameState {
  return {
    ...state,
    players: [
      recoverPlayer(state.players[0]),
      recoverPlayer(state.players[1]),
    ],
  };
}

function recoverPlayer(player: PlayerState): PlayerState {
  if (!isFallbackHitState(player)) {
    return player;
  }

  if (player.hitPause > 0) {
    return player;
  }

  if (player.stateTime < HIT_RECOVERY_FRAMES) {
    return player;
  }

  return {
    ...player,
    stateNo: 0,
    animNo: 0,
    stateTime: 0,
    animTime: 0,
    stateType: 'S',
    moveType: 'I',
    physics: 'S',
    ctrl: true,
    vx: 0,
    vy: 0,
    hitDefUsed: false,
    activeHitDef: null,
  };
}

function isFallbackHitState(player: PlayerState): boolean {
  return player.moveType === 'H' || player.stateNo === STAND_HIT_STATE || player.stateNo === AIR_HIT_STATE;
}
