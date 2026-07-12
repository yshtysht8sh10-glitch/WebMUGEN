import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const activeHitDef = {
  diagnosticId: 77,
  controllerKey: '200:0',
  damage: 20,
  guardDamage: 0,
  pauseTime: { attacker: 0, defender: 0 },
  groundVelocity: { x: -3, y: 0 },
  airVelocity: { x: -2, y: -4 },
};

function enterWithPersistence(hitDefPersist: number, moveHitPersist: number, hitCountPersist: number) {
  const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S
[State 200, Next]
type = ChangeState
trigger1 = 1
value = 201
[Statedef 201]
type = S
movetype = A
physics = S
hitdefpersist = ${hitDefPersist}
movehitpersist = ${moveHitPersist}
hitcountpersist = ${hitCountPersist}
`);
  const initial = createInitialGameState();
  return stepCnsStateRuntime({
    ...initial,
    players: [{
      ...initial.players[0],
      stateNo: 200,
      moveType: 'A',
      activeHitDef,
      hitDefUsed: true,
      hitTargets: [{ activeHitDefId: 77, defenderId: 2, hitDefId: 10 }],
      moveContact: { activeHitDefId: 77, contact: true, hit: true, guarded: false, hitCount: 3 },
    }, initial.players[1]],
  }, cns).state.players[0];
}

describe('StateDef HitDef persistence', () => {
  it('discards HitDef and move-hit state when all persistence flags are zero', () => {
    const player = enterWithPersistence(0, 0, 0);
    expect(player).toMatchObject({ stateNo: 201, activeHitDef: null, hitDefUsed: false, hitTargets: [] });
    expect(player.moveContact).toBeUndefined();
    expect(player.hitDiagnosticLines?.join('\n')).toContain('event=discard reason=state_change hitdefpersist=0 movehitpersist=0 hitcountpersist=0 hitCount=3');
  });

  it('preserves the active HitDef and consumed target history with hitdefpersist=1', () => {
    const player = enterWithPersistence(1, 0, 0);
    expect(player.activeHitDef).toEqual(activeHitDef);
    expect(player.hitDefUsed).toBe(true);
    expect(player.hitTargets).toEqual([{ activeHitDefId: 77, defenderId: 2, hitDefId: 10 }]);
    expect(player.moveContact).toBeUndefined();
    expect(player.hitDiagnosticLines?.join('\n')).toContain('event=preserve reason=state_change hitdefpersist=1');
  });

  it('preserves contact result and hit count independently', () => {
    const resultOnly = enterWithPersistence(0, 1, 0);
    expect(resultOnly.moveContact).toEqual({ activeHitDefId: 77, contact: true, hit: true, guarded: false, hitCount: 0 });

    const countOnly = enterWithPersistence(0, 0, 1);
    expect(countOnly.moveContact).toEqual({ activeHitDefId: 77, contact: false, hit: false, guarded: false, hitCount: 3 });

    const both = enterWithPersistence(0, 1, 1);
    expect(both.moveContact).toEqual({ activeHitDefId: 77, contact: true, hit: true, guarded: false, hitCount: 3 });
  });
});
