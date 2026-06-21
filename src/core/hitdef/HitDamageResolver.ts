import type { PlayerState } from '../engine/types';
import type { HitDefSpec } from './HitDefTypes';

export type HitDamageResult = {
  attacker: PlayerState;
  defender: PlayerState;
  damage: number;
};

export function applyHitDamage(
  attacker: PlayerState,
  defender: PlayerState,
  hitDef: HitDefSpec,
  guarded: boolean,
): HitDamageResult {
  const damage = Math.max(0, guarded ? hitDef.damage.guard : hitDef.damage.hit);

  return {
    attacker,
    defender: {
      ...defender,
      life: Math.max(0, defender.life - damage),
    },
    damage,
  };
}

export function applyHitVelocity(
  defender: PlayerState,
  hitDef: HitDefSpec,
  guarded: boolean,
): PlayerState {
  const velocity = guarded ? hitDef.guardVelocity : hitDef.hitVelocity;

  return {
    ...defender,
    vx: velocity.x,
    vy: velocity.y,
  };
}

export function applyHitPause(
  attacker: PlayerState,
  defender: PlayerState,
  hitDef: HitDefSpec,
): { attacker: PlayerState; defender: PlayerState } {
  return {
    attacker: { ...attacker, hitPause: hitDef.pause.attacker },
    defender: { ...defender, hitPause: hitDef.pause.defender },
  };
}
