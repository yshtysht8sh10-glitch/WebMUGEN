import type { PlayerState } from '../engine/types';
import type { HitAttribute } from './HitDefTypes';

export type GuardInput = {
  holdingBack: boolean;
  holdingDown: boolean;
};

export function canGuardHit(
  defender: PlayerState,
  attr: HitAttribute,
  input: GuardInput,
): boolean {
  if (defender.ctrl === false && defender.moveType !== 'H') {
    return false;
  }

  if (!input.holdingBack) {
    return false;
  }

  if (attr.stateType === 'A') {
    return true;
  }

  if (attr.category.includes('LA')) {
    return input.holdingDown;
  }

  if (attr.category.includes('HA')) {
    return !input.holdingDown;
  }

  return true;
}
