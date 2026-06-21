import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { createDefaultHitDefSpec } from './HitDefTypes';
import { resolveHitContact } from './HitContactResolver';

describe('Phase75 HitContactResolver', () => {
  it('applies unguarded hit contact and emits spark event', () => {
    const state = createInitialGameState();
    const hitDef = {
      ...createDefaultHitDefSpec(),
      damage: { hit: 25, guard: 3 },
      pause: { attacker: 2, defender: 6 },
      hitVelocity: { x: -4, y: -1 },
      sparkNo: 9000,
    };

    const result = resolveHitContact(
      [state.players[0], { ...state.players[1], life: 100 }],
      1,
      hitDef,
      { holdingBack: false, holdingDown: false },
    );

    expect(result.guarded).toBe(false);
    expect(result.damage).toBe(25);
    expect(result.players[1]).toMatchObject({ life: 75, vx: -4, vy: -1, hitPause: 6 });
    expect(result.events).toEqual([
      { type: 'explod', id: null, animNo: 9000, x: state.players[1].x, y: state.players[1].y, removeTime: 12 },
    ]);
  });
});
