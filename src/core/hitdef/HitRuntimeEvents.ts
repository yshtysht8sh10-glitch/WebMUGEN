import type { RuntimeEvent } from '../runtime/RuntimeEventQueue';
import type { PlayerState } from '../engine/types';
import type { HitDefSpec } from './HitDefTypes';

export type HitOutcome = {
  attackerId: 1 | 2;
  defenderId: 1 | 2;
  guarded: boolean;
  damage: number;
  sparkNo: number | null;
};

export function createHitOutcome(
  attackerId: 1 | 2,
  defenderId: 1 | 2,
  hitDef: HitDefSpec,
  guarded: boolean,
): HitOutcome {
  return {
    attackerId,
    defenderId,
    guarded,
    damage: guarded ? hitDef.damage.guard : hitDef.damage.hit,
    sparkNo: guarded ? hitDef.guardSparkNo : hitDef.sparkNo,
  };
}

export function createHitSparkEvents(
  outcome: HitOutcome,
  defender: PlayerState,
): RuntimeEvent[] {
  if (outcome.sparkNo === null) {
    return [];
  }

  return [
    {
      type: 'explod',
      id: null,
      animNo: outcome.sparkNo,
      x: defender.x,
      y: defender.y,
      removeTime: 12,
    },
  ];
}
