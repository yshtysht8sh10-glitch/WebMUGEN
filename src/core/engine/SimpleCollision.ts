import type { ActiveHitDef, GameState, HitEvent, PlayerState, Rect } from './types';

export type SimpleCollisionResult = Pick<GameState, 'players' | 'hitEvents'>;

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

export function resolveSimpleHits(players: [PlayerState, PlayerState]): SimpleCollisionResult {
  let p1 = players[0];
  let p2 = players[1];
  const hitEvents: HitEvent[] = [];

  const p1Hit = canHit(p1) && intersects(getAttackBox(p1), getBodyBox(p2));
  const p2Hit = canHit(p2) && intersects(getAttackBox(p2), getBodyBox(p1));

  if (p1Hit && p2.hitPause === 0) {
    const hitDef = p1.activeHitDef ?? FALLBACK_HITDEF;
    p1 = markHitDefUsed(applyAttackerPause(p1, hitDef));
    p2 = applyHit(p2, p1, hitDef);
    hitEvents.push({ attackerId: 1, defenderId: 2, damage: hitDef.damage });
  }

  if (p2Hit && p1.hitPause === 0) {
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

export function getBodyBox(player: PlayerState): Rect {
  return {
    x: player.x - 16,
    y: player.y - 78,
    width: 32,
    height: 78,
  };
}

export function getAttackBox(player: PlayerState): Rect {
  if (!isAttackActive(player)) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
  }

  return {
    x: player.facing === 1 ? player.x + 28 : player.x - 70,
    y: player.y - 52,
    width: 42,
    height: 16,
  };
}

export function isAttackActive(player: PlayerState): boolean {
  return player.stateNo === 200 && player.animTime >= 5 && player.animTime <= 12;
}

function canHit(player: PlayerState): boolean {
  return isAttackActive(player) && !player.hitDefUsed;
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
  const velocity =
    defender.stateType === 'A' || defender.y < 285 ? hitDef.airVelocity : hitDef.groundVelocity;

  return {
    ...defender,
    life: Math.max(0, defender.life - hitDef.damage),
    stateType: velocity.y !== 0 ? 'A' : defender.stateType,
    physics: velocity.y !== 0 ? 'A' : defender.physics,
    vx: attacker.facing * Math.abs(velocity.x),
    vy: velocity.y,
    hitPause: hitDef.pauseTime.defender,
  };
}

function intersects(a: Rect, b: Rect): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) {
    return false;
  }

  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
