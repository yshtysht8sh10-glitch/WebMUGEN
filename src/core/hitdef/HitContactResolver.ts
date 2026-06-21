import type { PlayerState } from '../engine/types';
import type { RuntimeEvent } from '../runtime/RuntimeEventQueue';
import { canGuardHit, type GuardInput } from './GuardResolver';
import { applyHitDamage, applyHitPause, applyHitVelocity } from './HitDamageResolver';
import type { HitDefSpec } from './HitDefTypes';
import { createHitOutcome, createHitSparkEvents } from './HitRuntimeEvents';

export type HitContactResult = {
  players: [PlayerState, PlayerState];
  guarded: boolean;
  damage: number;
  events: RuntimeEvent[];
};

export function resolveHitContact(
  players: readonly [PlayerState, PlayerState],
  attackerId: 1 | 2,
  hitDef: HitDefSpec,
  defenderInput: GuardInput,
): HitContactResult {
  const defenderId = attackerId === 1 ? 2 : 1;
  const attacker = players[attackerId - 1];
  const defender = players[defenderId - 1];
  const guarded = canGuardHit(defender, hitDef.attr, defenderInput);
  const damaged = applyHitDamage(attacker, defender, hitDef, guarded);
  const movedDefender = applyHitVelocity(damaged.defender, hitDef, guarded);
  const paused = applyHitPause(damaged.attacker, movedDefender, hitDef);
  const nextPlayers = [...players] as [PlayerState, PlayerState];

  nextPlayers[attackerId - 1] = paused.attacker;
  nextPlayers[defenderId - 1] = paused.defender;

  return {
    players: nextPlayers,
    guarded,
    damage: damaged.damage,
    events: createHitSparkEvents(createHitOutcome(attackerId, defenderId, hitDef, guarded), defender),
  };
}
