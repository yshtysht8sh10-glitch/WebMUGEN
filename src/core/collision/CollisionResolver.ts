import type { AirDocument } from '../../parser/air/AirTypes';
import { getCurrentAnimationElement } from '../animation/AnimationPlayer';
import type { ActiveHitDef, GameState, HitEvent, PlayerState, Rect } from '../engine/types';
import { airBoxToWorldRect, intersects, type WorldCollisionBox } from './CollisionBox';

export type CollisionResult = Pick<GameState, 'players' | 'hitEvents'>;

const FALLBACK_HITDEF: ActiveHitDef = {
  damage: 50,
  guardDamage: 0,
  pauseTime: {
    attacker: 4,
    defender: 8,
  },
  groundVelocity: {
    x: -3.5,
    y: 0,
  },
  airVelocity: {
    x: -2.5,
    y: -5.5,
  },
};

const STAND_HIT_STATE = 5000;
const AIR_HIT_STATE = 5030;

export function resolveClsnHits(
  players: [PlayerState, PlayerState],
  airDocument: AirDocument,
): CollisionResult {
  let p1 = players[0];
  let p2 = players[1];
  const hitEvents: HitEvent[] = [];

  const p1Attack = getPlayerAttackBoxes(p1, airDocument);
  const p1Body = getPlayerBodyBoxes(p1, airDocument);
  const p2Attack = getPlayerAttackBoxes(p2, airDocument);
  const p2Body = getPlayerBodyBoxes(p2, airDocument);

  const p1CanHit = canHit(p1) && p1Attack.length > 0;
  const p2CanHit = canHit(p2) && p2Attack.length > 0;

  if (p1CanHit && p2.hitPause === 0 && anyIntersects(p1Attack, p2Body)) {
    const hitDef = p1.activeHitDef ?? FALLBACK_HITDEF;
    p1 = markHitDefUsed(applyAttackerPause(p1, hitDef));
    p2 = applyHit(p2, p1, hitDef);
    hitEvents.push({ attackerId: 1, defenderId: 2, damage: hitDef.damage });
  }

  if (p2CanHit && p1.hitPause === 0 && anyIntersects(p2Attack, p1Body)) {
    const hitDef = p2.activeHitDef ?? FALLBACK_HITDEF;
    p2 = markHitDefUsed(applyAttackerPause(p2, hitDef));
    p1 = applyHit(p1, p2, hitDef);
    hitEvents.push({ attackerId: 2, defenderId: 1, damage: hitDef.damage });
  }

  return {
    players: [p1, p2],
    hitEvents,
  };
}

export function getPlayerAttackBoxes(
  player: PlayerState,
  airDocument: AirDocument,
): WorldCollisionBox[] {
  const current = getCurrentAnimationElement(airDocument, player.animNo, player.animTime);
  return current ? current.element.clsn1.map((box, boxIndex) => airBoxToWorldRect(
    player, box, 'attack', { x: current.element.offsetX, y: current.element.offsetY },
    { source: current.element.clsn1Source ?? 'none', animNo: player.animNo, elementIndex: current.elementIndex, boxIndex },
  )) : [];
}

export function getPlayerBodyBoxes(
  player: PlayerState,
  airDocument: AirDocument,
): WorldCollisionBox[] {
  const current = getCurrentAnimationElement(airDocument, player.animNo, player.animTime);
  return current ? current.element.clsn2.map((box, boxIndex) => airBoxToWorldRect(
    player, box, 'body', { x: current.element.offsetX, y: current.element.offsetY },
    { source: current.element.clsn2Source ?? 'none', animNo: player.animNo, elementIndex: current.elementIndex, boxIndex },
  )) : [];
}

export function anyIntersects(a: Rect[], b: Rect[]): boolean {
  return a.some((boxA) => b.some((boxB) => intersects(boxA, boxB)));
}

function canHit(player: PlayerState): boolean {
  return player.moveType === 'A' && !player.hitDefUsed;
}

function applyAttackerPause(attacker: PlayerState, hitDef: ActiveHitDef): PlayerState {
  return {
    ...attacker,
    hitPause: hitDef.pauseTime.attacker,
  };
}

function markHitDefUsed(attacker: PlayerState): PlayerState {
  return {
    ...attacker,
    hitDefUsed: true,
  };
}

function applyHit(defender: PlayerState, attacker: PlayerState, hitDef: ActiveHitDef): PlayerState {
  const isAirHit = defender.stateType === 'A' || defender.y < 285;
  const velocity = isAirHit ? hitDef.airVelocity : hitDef.groundVelocity;
  const launched = velocity.y !== 0;

  return {
    ...defender,
    life: Math.max(0, defender.life - hitDef.damage),
    stateNo: launched || isAirHit ? AIR_HIT_STATE : STAND_HIT_STATE,
    stateTime: 0,
    animNo: launched || isAirHit ? AIR_HIT_STATE : STAND_HIT_STATE,
    animTime: 0,
    stateType: launched || isAirHit ? 'A' : 'S',
    moveType: 'H',
    physics: launched || isAirHit ? 'A' : 'N',
    ctrl: false,
    vx: attacker.facing * Math.abs(velocity.x),
    vy: velocity.y,
    hitPause: hitDef.pauseTime.defender,
    activeHitDef: null,
    hitDefUsed: false,
  };
}
