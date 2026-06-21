import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { canGuardHit } from './GuardResolver';

describe('Phase68 GuardResolver', () => {
  const defender = createInitialGameState().players[1];

  it('requires holding back', () => {
    expect(canGuardHit(defender, { stateType: 'S', category: 'NA' }, { holdingBack: false, holdingDown: false })).toBe(false);
    expect(canGuardHit(defender, { stateType: 'S', category: 'NA' }, { holdingBack: true, holdingDown: false })).toBe(true);
  });

  it('handles high and low attack hints', () => {
    expect(canGuardHit(defender, { stateType: 'S', category: 'LA' }, { holdingBack: true, holdingDown: false })).toBe(false);
    expect(canGuardHit(defender, { stateType: 'S', category: 'LA' }, { holdingBack: true, holdingDown: true })).toBe(true);
    expect(canGuardHit(defender, { stateType: 'S', category: 'HA' }, { holdingBack: true, holdingDown: true })).toBe(false);
  });
});
