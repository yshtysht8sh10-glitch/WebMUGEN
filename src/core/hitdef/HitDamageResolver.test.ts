import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { createDefaultHitDefSpec } from './HitDefTypes';
import { applyHitDamage, applyHitPause, applyHitVelocity } from './HitDamageResolver';

describe('Phase69 HitDamageResolver', () => {
  const state = createInitialGameState();
  const hitDef = {
    ...createDefaultHitDefSpec(),
    damage: { hit: 30, guard: 5 },
    pause: { attacker: 4, defender: 8 },
    hitVelocity: { x: -3, y: -2 },
    guardVelocity: { x: -1, y: 0 },
  };

  it('applies hit and guard damage', () => {
    expect(applyHitDamage(state.players[0], { ...state.players[1], life: 100 }, hitDef, false).defender.life).toBe(70);
    expect(applyHitDamage(state.players[0], { ...state.players[1], life: 100 }, hitDef, true).defender.life).toBe(95);
  });

  it('applies velocity and pause', () => {
    expect(applyHitVelocity(state.players[1], hitDef, false)).toMatchObject({ vx: -3, vy: -2 });
    expect(applyHitVelocity(state.players[1], hitDef, true)).toMatchObject({ vx: -1, vy: 0 });

    const paused = applyHitPause(state.players[0], state.players[1], hitDef);
    expect(paused.attacker.hitPause).toBe(4);
    expect(paused.defender.hitPause).toBe(8);
  });
});
