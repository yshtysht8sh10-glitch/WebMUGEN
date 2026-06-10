import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { stepPlayerByCns } from './CnsStateMachine';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { resolveSimpleHits } from './SimpleCollision';

describe('phase7 physics fix', () => {
  it('applies ground friction', () => {
    const document = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1
`);
    const player = {
      ...createInitialGameState().players[0],
      vx: 2,
    };

    const next = stepPlayerByCns(player, document, {
      input: { left: false, right: false, up: false, attack: false },
      animLength: 60,
      moveHit: false,
    });

    expect(next.vx).toBeLessThan(2);
  });

  it('launch hit target with gravity-enabled state', () => {
    const state = createInitialGameState();
    const p1 = {
      ...state.players[0],
      x: 220,
      stateNo: 200,
      animTime: 6,
      facing: 1 as const,
    };
    const p2 = {
      ...state.players[1],
      x: 270,
      life: 1000,
    };

    const result = resolveSimpleHits([p1, p2]);

    expect(result.players[1].life).toBe(950);
    expect(result.players[1].stateType).toBe('A');
    expect(result.players[1].physics).toBe('A');
    expect(result.players[1].vy).toBeLessThan(0);
  });
});
