import type { AirDocument } from '../../parser/air/AirTypes';
import {
  anyIntersects,
  getPlayerAttackBoxes,
  getPlayerBodyBoxes,
} from '../collision/CollisionResolver';
import type { GameState, HitEvent, PlayerState } from './types';

const FALLBACK_DAMAGE = 60;
const ATTACKER_HIT_PAUSE = 4;
const DEFENDER_HIT_PAUSE = 8;
const STAND_HIT_STATE = 5000;

export function resolveFallbackHits(state: GameState, airDocument?: AirDocument | null): GameState {
  if (!airDocument) {
    return state;
  }

  let p1 = state.players[0];
  let p2 = state.players[1];
  const hitEvents: HitEvent[] = [];

  const p1Attack = getPlayerAttackBoxes(p1, airDocument);
  const p1Body = getPlayerBodyBoxes(p1, airDocument);
  const p2Attack = getPlayerAttackBoxes(p2, airDocument);
  const p2Body = getPlayerBodyBoxes(p2, airDocument);

  if (canFallbackHit(p1) && p2.hitPause === 0 && anyIntersects(p1Attack, p2Body)) {
    p1 = markAttackerHit(p1);
    p2 = applyFallbackHit(p2, p1);
    hitEvents.push({ attackerId: 1, defenderId: 2, damage: FALLBACK_DAMAGE });
  }

  if (canFallbackHit(p2) && p1.hitPause === 0 && anyIntersects(p2Attack, p1Body)) {
    p2 = markAttackerHit(p2);
    p1 = applyFallbackHit(p1, p2);
    hitEvents.push({ attackerId: 2, defenderId: 1, damage: FALLBACK_DAMAGE });
  }

  return {
    ...state,
    players: [p1, p2],
    hitEvents,
  };
}

function canFallbackHit(player: PlayerState): boolean {
  return player.moveType === 'A' && !player.hitDefUsed && player.hitPause === 0;
}

function markAttackerHit(player: PlayerState): PlayerState {
  return {
    ...player,
    hitPause: ATTACKER_HIT_PAUSE,
    hitDefUsed: true,
  };
}

function applyFallbackHit(defender: PlayerState, attacker: PlayerState): PlayerState {
  return {
    ...defender,
    life: Math.max(0, defender.life - FALLBACK_DAMAGE),
    stateNo: STAND_HIT_STATE,
    animNo: STAND_HIT_STATE,
    stateTime: 0,
    animTime: 0,
    stateType: 'S',
    moveType: 'H',
    physics: 'N',
    ctrl: false,
    vx: attacker.facing * 4,
    vy: 0,
    hitPause: DEFENDER_HIT_PAUSE,
    hitDefUsed: false,
    activeHitDef: null,
  };
}
