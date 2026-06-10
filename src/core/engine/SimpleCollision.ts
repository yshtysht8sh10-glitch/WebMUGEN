import type { GameState, HitEvent, PlayerState, Rect } from './types';

export type SimpleCollisionResult = Pick<GameState, 'players' | 'hitEvents'>;

const ATTACK_DAMAGE = 50;
const HIT_PAUSE_FRAMES = 8;

export function resolveSimpleHits(players: [PlayerState, PlayerState]): SimpleCollisionResult {
  let p1 = players[0];
  let p2 = players[1];
  const hitEvents: HitEvent[] = [];

  const p1Hit = isAttackActive(p1) && p1.animTime === 6 && intersects(getAttackBox(p1), getBodyBox(p2));
  const p2Hit = isAttackActive(p2) && p2.animTime === 6 && intersects(getAttackBox(p2), getBodyBox(p1));

  if (p1Hit && p2.hitPause === 0) {
    p2 = applyHit(p2, p1);
    hitEvents.push({ attackerId: 1, defenderId: 2, damage: ATTACK_DAMAGE });
  }

  if (p2Hit && p1.hitPause === 0) {
    p1 = applyHit(p1, p2);
    hitEvents.push({ attackerId: 2, defenderId: 1, damage: ATTACK_DAMAGE });
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

function applyHit(defender: PlayerState, attacker: PlayerState): PlayerState {
  return {
    ...defender,
    life: Math.max(0, defender.life - ATTACK_DAMAGE),
    stateType: 'A',
    physics: 'A',
    vx: attacker.facing * 3.5,
    vy: -4.5,
    hitPause: HIT_PAUSE_FRAMES,
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
