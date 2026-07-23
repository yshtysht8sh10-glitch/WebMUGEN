import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { resolveFallbackHits } from '../engine/FallbackHitResolver';
import { evaluateCnsRuntimeTrigger } from './CnsRuntimeTrigger';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const air = parseAirText(`
[Begin Action 0]
Clsn2Default: 1
 Clsn2[0] = -20,-80,20,0
0,0, 0,0, 5
[Begin Action 200]
Clsn2Default: 1
 Clsn2[0] = -20,-80,20,0
Clsn1: 1
 Clsn1[0] = 10,-60,70,-30
200,0, 0,0, 5
`);

describe('combat compatibility controller batch', () => {
  it('updates the current live HitDef guard distance through AttackDist', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = N
anim = 200
[State 200, hit]
type = HitDef
trigger1 = 1
attr = S, NA
damage = 30, 4
guardflag = H
guard.dist = 160
[State 200, distance]
type = AttackDist
trigger1 = 1
value = 24
`);
    const initial = createInitialGameState();
    initial.players[0] = { ...initial.players[0], stateNo: 200, animNo: 200, moveType: 'A', x: 300 };
    const activated = stepCnsStateRuntime(initial, cns).state;
    expect(activated.players[0].activeHitDef?.guardDistance).toBe(24);
  });

  it('routes matching contact through a timed HitOverride slot without normal damage', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = N
anim = 200
[State 200, hit]
type = HitDef
trigger1 = 1
attr = S, NA
damage = 80, 0
pausetime = 2, 3
[Statedef 300]
type = S
physics = N
anim = 0
[State 300, override]
type = HitOverride
trigger1 = 1
slot = 2
attr = SCA, NA
stateno = 900
time = 5
forceair = 1
`);
    const initial = createInitialGameState();
    initial.players = [
      { ...initial.players[0], stateNo: 200, animNo: 200, moveType: 'A', x: 300 },
      { ...initial.players[1], stateNo: 300, animNo: 0, x: 350 },
    ];
    const activated = stepCnsStateRuntime(initial, cns).state;
    const result = resolveFallbackHits(activated, air, true);

    expect(result.players[1]).toMatchObject({ life: 1000, stateNo: 900, stateType: 'A', hitPause: 3 });
    expect(result.players[0].moveContact).toMatchObject({ contact: true, hit: true });
    expect(result.hitDiagnosticLines?.join('\n')).toContain('raw.hit_override attacker=p1 target=p2');
  });

  it('resolves ReversalDef as an attack-vs-attack event with MoveReversed and custom states', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = N
anim = 200
[State 200, hit]
type = HitDef
trigger1 = 1
attr = S, NA
damage = 100, 0
[Statedef 400]
type = S
movetype = A
physics = N
anim = 200
[State 400, reversal]
type = ReversalDef
trigger1 = 1
reversal.attr = SCA, NA
p1stateno = 401
p2stateno = 402
pausetime = 4, 6
`);
    const initial = createInitialGameState();
    initial.players = [
      { ...initial.players[0], stateNo: 400, animNo: 200, moveType: 'A', x: 300 },
      { ...initial.players[1], stateNo: 200, animNo: 200, moveType: 'A', x: 350, facing: -1 },
    ];
    const activated = stepCnsStateRuntime(initial, cns).state;
    const result = resolveFallbackHits(activated, air, true);

    expect(result.players[0]).toMatchObject({ stateNo: 401, hitPause: 4, moveContact: { reversed: true, elapsed: 1 } });
    expect(result.players[1]).toMatchObject({ stateNo: 402, stateOwnerId: 1, hitPause: 6, activeHitDef: null, life: 1000 });
    expect(result.players[0].targets).toContainEqual(expect.objectContaining({ playerId: 2 }));
    expect(evaluateCnsRuntimeTrigger('MoveReversed', { player: result.players[0] })).toBe(true);
    expect(result.hitDiagnosticLines?.join('\n')).toContain('raw.reversal attacker=p2 reverser=p1');
  });
});
