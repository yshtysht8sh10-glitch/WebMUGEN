import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { createInitialGameState } from './GameState';
import { resolveFallbackHits } from './FallbackHitResolver';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { applyFallbackHitRecovery } from './FallbackHitRecovery';

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

[Begin Action 5000]
0,0, 0,0, 5
[Begin Action 5001]
0,0, 0,0, 5
[Begin Action 5002]
0,0, 0,0, 5
`);

describe('FallbackHitResolver', () => {
  it.each([
    ['Light', 5000],
    ['Medium', 5001],
    ['Hard', 5002],
  ] as const)('selects grounded animtype %s as Anim %i', (animType, selectedAnim) => {
    const hit = resolveConfiguredHit({ damage: 100, groundHitTime: 20, animType });

    expect(hit.players[1]).toMatchObject({ life: 900, animNo: selectedAnim });
    expect(hit.players[1].hitStun).toMatchObject({ selectedHitTime: 20, selectedAnim });
    expect(hit.hitDiagnosticLines?.join('\n')).toContain(`animType=${animType} targetStateTypeAtHit=S requestedAnim=${selectedAnim} selectedAnim=${selectedAnim}`);
  });

  it.each([
    ['Medium', 5001],
    ['Hard', 5002],
  ] as const)('keeps required Anim %i selected when it is missing', (animType, selectedAnim) => {
    const missingRequiredAnim = { ...air, actions: air.actions.filter((action) => action.actionNo !== selectedAnim) };
    const hit = resolveConfiguredHit({ animType, airDocument: missingRequiredAnim });

    expect(hit.players[1].animNo).toBe(selectedAnim);
    expect(hit.hitDiagnosticLines?.join('\n')).toContain(`requestedAnim=${selectedAnim} selectedAnim=${selectedAnim} animationExists=0`);
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('warning=missing_required_animation');
  });

  it('preserves the existing Anim 5000 behavior when animtype is omitted', () => {
    const hit = resolveConfiguredHit({});
    expect(hit.players[1].animNo).toBe(5000);
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('animType=Light targetStateTypeAtHit=S requestedAnim=5000 selectedAnim=5000');
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('source=existing_fallback fallbackReason=existing_fixed_5000');
  });

  it.each(['Back', 'Up', 'DiagUp'])('does not implement out-of-scope animtype %s', (animType) => {
    const hit = resolveConfiguredHit({ animType });
    expect(hit.players[1].animNo).toBe(5000);
    expect(hit.players[0].activeHitDef?.animTypeSource).toBe('existing_fallback');
  });

  it('does not apply grounded animtype selection to an airborne target', () => {
    const hit = resolveConfiguredHit({ animType: 'Hard', targetStateType: 'A' });
    expect(hit.players[1].animNo).toBe(5000);
    expect(hit.players[1].hitStun?.targetStateTypeAtHit).toBe('A');
    expect(hit.hitDiagnosticLines?.join('\n')).not.toContain('raw.hit_anim_select');
  });
  it.each([7, 20])('uses ground.hittime=%i for a grounded target', (hitTime) => {
    const hit = resolveConfiguredHit({ damage: 37, groundHitTime: hitTime });
    const target = hit.players[1];

    expect(target.hitStun).toMatchObject({ selectedHitTime: hitTime, kind: 'ground', source: 'active_hitdef' });
    expect(hit.hitDiagnosticLines?.join('\n')).toContain(`hittime=${hitTime} source=active_hitdef hittimeKind=ground targetStateTypeAtHit=S`);

    const before = applyFallbackHitRecovery({
      ...hit,
      players: [hit.players[0], { ...target, hitPause: 0, hitStun: target.hitStun ? { ...target.hitStun, elapsed: Math.max(0, hitTime - 1) } : target.hitStun }],
    });
    const ended = applyFallbackHitRecovery({
      ...hit,
      players: [hit.players[0], { ...target, hitPause: 0, hitStun: target.hitStun ? { ...target.hitStun, elapsed: hitTime } : target.hitStun }],
    });
    if (hitTime > 0) expect(before.players[1].ctrl).toBe(false);
    expect(ended.players[1].stateNo).toBe(0);
    expect(ended.hitDiagnosticLines?.join('\n')).toContain(`event=end selectedHitTime=${hitTime}`);
  });

  it('selects air.hittime for a target airborne at contact', () => {
    const hit = resolveConfiguredHit({ groundHitTime: 20, airHitTime: 11, targetStateType: 'A' });

    expect(hit.players[1].hitStun).toMatchObject({ selectedHitTime: 11, kind: 'air', targetStateTypeAtHit: 'A' });
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('hittime=11 source=active_hitdef hittimeKind=air targetStateTypeAtHit=A');
  });

  it('treats ground.hittime=0 as an explicit value', () => {
    const hit = resolveConfiguredHit({ groundHitTime: 0 });

    expect(hit.players[1].hitStun).toMatchObject({ selectedHitTime: 0, kind: 'ground', source: 'active_hitdef' });
    expect(hit.hitDiagnosticLines?.join('\n')).not.toContain('missing_ground_hittime');
  });

  it('uses hardcoded 28 when ground.hittime is missing and logs the reason', () => {
    const hit = resolveConfiguredHit({ damage: 100 });

    expect(hit.players[1].life).toBe(900);
    expect(hit.players[1].hitStun).toMatchObject({ selectedHitTime: 28, kind: 'fallback', fallbackReason: 'missing_ground_hittime' });
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('selectedHitTime=28 kind=fallback');
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('fallbackReason=missing_ground_hittime');
  });

  it('applies the same ground.hittime selection when P2 attacks P1', () => {
    const hit = resolveConfiguredHit({ damage: 100, groundHitTime: 7, animType: 'Hard', attackerId: 2 });

    expect(hit.players[0].life).toBe(900);
    expect(hit.players[0].hitStun).toMatchObject({ selectedHitTime: 7, kind: 'ground' });
    expect(hit.players[0].animNo).toBe(5002);
  });

  it.each([7, 37])('applies CNS HitDef damage %i to the live hit path', (damage) => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S

[State 200, Hit]
type = HitDef
trigger1 = 1
damage = ${damage}, 0
`);
    const initial = createInitialGameState();
    const runtime = stepCnsStateRuntime({
      ...initial,
      players: [
        { ...initial.players[0], x: 240, stateNo: 200, animNo: 200, moveType: 'A' },
        { ...initial.players[1], x: 290, animNo: 0 },
      ],
    }, cns).state;

    const next = resolveFallbackHits(runtime, air);

    expect(runtime.players[0].activeHitDef?.damage).toBe(damage);
    expect(next.players[1].life).toBe(1000 - damage);
    expect(next.hitEvents[0]?.damage).toBe(damage);
    expect(next.hitDiagnosticLines?.join('\n')).toContain('source=active_hitdef');
    expect(next.hitDiagnosticLines?.join('\n')).toContain(`appliedDamage=${damage}`);
    expect(next.hitDiagnosticLines?.join('\n')).toContain('event=consume reason=successful_hit hitCount=1');
  });

  it('logs one miss for an ActiveHitDef whose attack box does not overlap', () => {
    const state = createInitialGameState();
    const next = resolveFallbackHits({
      ...state,
      players: [
        {
          ...state.players[0], x: 100, animNo: 200, moveType: 'A',
          activeHitDef: {
            diagnosticId: 900, damage: 7, guardDamage: 0, damageValues: [7, 0], damageSource: 'cns',
            pauseTime: { attacker: 4, defender: 8 }, groundVelocity: { x: -3.5, y: 0 }, airVelocity: { x: -2.5, y: -5.5 },
          },
        },
        { ...state.players[1], x: 500, animNo: 0 },
      ],
    }, air);

    expect(next.hitEvents).toHaveLength(0);
    expect(next.hitDiagnosticLines?.join('\n')).toContain('result=miss reason=clsn_no_overlap');
  });

  it('logs KO life subtraction with the same ActiveHitDef id', () => {
    const state = createInitialGameState();
    const next = resolveFallbackHits({
      ...state,
      players: [
        {
          ...state.players[0], x: 240, animNo: 200, moveType: 'A',
          activeHitDef: {
            diagnosticId: 901, damage: 37, guardDamage: 0, damageValues: [37, 0], damageSource: 'cns',
            pauseTime: { attacker: 4, defender: 8 }, groundVelocity: { x: -3.5, y: 0 }, airVelocity: { x: -2.5, y: -5.5 },
          },
        },
        { ...state.players[1], x: 290, animNo: 0, life: 20 },
      ],
    }, air);

    expect(next.players[1].life).toBe(0);
    expect(next.hitDiagnosticLines?.join('\n')).toContain('activeHitDefId=901 lifeBefore=20 appliedDamage=37 lifeAfter=0 source=active_hitdef ko=1');
  });

  it('does not reset one-hit control when HitDef executes again', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S

[State 200, Hit]
type = HitDef
trigger1 = 1
damage = 25
`);
    const initial = createInitialGameState();
    const runtime = stepCnsStateRuntime({
      ...initial,
      players: [
        { ...initial.players[0], stateNo: 200, moveType: 'A', hitDefUsed: true },
        initial.players[1],
      ],
    }, cns).state;

    expect(runtime.players[0].activeHitDef?.damage).toBe(25);
    expect(runtime.players[0].hitDefUsed).toBe(true);
  });

  it('reuses the ActiveHitDef id and reports a duplicate controller only once', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
[State 200, Hit]
type = HitDef
trigger1 = 1
damage = 37, 0
`);
    const initial = createInitialGameState();
    const first = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 200, moveType: 'A' }, initial.players[1]],
    }, cns).state;
    const second = stepCnsStateRuntime(first, cns).state;
    const third = stepCnsStateRuntime(second, cns).state;

    expect(second.players[0].activeHitDef?.diagnosticId).toBe(first.players[0].activeHitDef?.diagnosticId);
    expect(second.players[0].hitDiagnosticLines?.join('\n')).toContain('event=duplicate_ignore');
    expect(third.players[0].hitDiagnosticLines).toEqual([]);
  });

  it('does not generate diagnostic lines when hit diagnostics are disabled', () => {
    const state = createInitialGameState();
    const next = resolveFallbackHits({
      ...state,
      players: [
        { ...state.players[0], x: 240, animNo: 200, moveType: 'A' },
        { ...state.players[1], x: 290, animNo: 0 },
      ],
    }, air, false);

    expect(next.hitEvents).toHaveLength(0);
    expect(next.hitDiagnosticLines).toEqual([]);
  });

  it('rejects overlapping Clsn when the attacker has no ActiveHitDef', () => {
    const state = createInitialGameState();
    const next = resolveFallbackHits(
      {
        ...state,
        players: [
          {
            ...state.players[0],
            x: 240,
            y: 285,
            facing: 1,
            stateNo: 200,
            animNo: 200,
            moveType: 'A',
            hitDefUsed: false,
          },
          {
            ...state.players[1],
            x: 290,
            y: 285,
            facing: -1,
            stateNo: 0,
            animNo: 0,
            moveType: 'I',
          },
        ],
      },
      air,
    );

    expect(next.hitEvents).toHaveLength(0);
    expect(next.players[1].life).toBe(1000);
    expect(next.hitDiagnosticLines?.join('\n')).toContain('clsn1=1 clsn2=1 result=rejected reason=active_hitdef_missing');
  });

  it('logs AIR animation, element, box counts, and overlapping indexes for an accepted hit', () => {
    const hit = resolveConfiguredHit({ damage: 31, groundHitTime: 9 });
    const lines = hit.hitDiagnosticLines?.join('\n') ?? '';
    expect(hit.hitEvents).toHaveLength(1);
    expect(lines).toContain('attackerAnim=200 attackerElem=0 defenderAnim=0 defenderElem=0 clsn1=1 clsn2=1');
    expect(lines).toContain('overlap=0:0 damage=31,0 source=active_hitdef');
  });

  it('diagnoses missing Clsn1 and Clsn2 without fixed rectangles', () => {
    const noAttackAir = { ...air, actions: air.actions.map((action) => action.actionNo === 200 ? { ...action, elements: action.elements.map((element) => ({ ...element, clsn1: [] })) } : action) };
    const noBodyAir = { ...air, actions: air.actions.map((action) => action.actionNo === 0 ? { ...action, elements: action.elements.map((element) => ({ ...element, clsn2: [] })) } : action) };
    expect(resolveConfiguredHit({ airDocument: noAttackAir }).hitDiagnosticLines?.join('\n')).toContain('reason=clsn1_missing');
    expect(resolveConfiguredHit({ airDocument: noBodyAir }).hitDiagnosticLines?.join('\n')).toContain('reason=clsn2_missing');
  });

  it('does not hit twice while hitDefUsed is true', () => {
    const state = createInitialGameState();
    const next = resolveFallbackHits(
      {
        ...state,
        players: [
          {
            ...state.players[0],
            x: 240,
            y: 285,
            facing: 1,
            stateNo: 200,
            animNo: 200,
            moveType: 'A',
            hitDefUsed: true,
          },
          {
            ...state.players[1],
            x: 290,
            y: 285,
            facing: -1,
            stateNo: 0,
            animNo: 0,
            moveType: 'I',
          },
        ],
      },
      air,
    );

    expect(next.hitEvents).toHaveLength(0);
    expect(next.players[1].life).toBe(1000);
  });

  it('does not reset selected hit time after continued contact is rejected', () => {
    const first = resolveConfiguredHit({ groundHitTime: 7, animType: 'Medium' });
    const second = resolveFallbackHits({
      ...first,
      players: [
        { ...first.players[0], hitPause: 0 },
        { ...first.players[1], hitPause: 0 },
      ],
    }, air);

    expect(second.hitEvents).toHaveLength(0);
    expect(second.players[1].hitStun?.selectedHitTime).toBe(7);
    expect(second.players[1].animNo).toBe(5001);
    expect(second.hitDiagnosticLines?.join('\n')).not.toContain('raw.hit_anim_select');
  });

  it('does not keep stale hit events when no new contact occurs', () => {
    const state = createInitialGameState();
    const next = resolveFallbackHits(
      {
        ...state,
        hitEvents: [{ attackerId: 1, defenderId: 2, damage: 60 }],
        players: [
          {
            ...state.players[0],
            x: 120,
            y: 285,
            facing: 1,
            stateNo: 0,
            animNo: 0,
            moveType: 'I',
            hitDefUsed: false,
          },
          {
            ...state.players[1],
            x: 420,
            y: 285,
            facing: -1,
            stateNo: 0,
            animNo: 0,
            moveType: 'I',
          },
        ],
      },
      air,
    );

    expect(next.hitEvents).toHaveLength(0);
  });
});

function resolveConfiguredHit({
  damage = 37,
  groundHitTime,
  airHitTime,
  targetStateType = 'S',
  attackerId = 1,
  animType,
  airDocument = air,
}: {
  damage?: number;
  groundHitTime?: number;
  airHitTime?: number;
  targetStateType?: 'S' | 'A';
  attackerId?: 1 | 2;
  animType?: string;
  airDocument?: typeof air;
}) {
  const hitTimeLines = [
    groundHitTime === undefined ? '' : `ground.hittime = ${groundHitTime}`,
    airHitTime === undefined ? '' : `air.hittime = ${airHitTime}`,
  ].filter(Boolean).join('\n');
  const animTypeLine = animType === undefined ? '' : `animtype = ${animType}`;
  const cns = parseCnsText(`
[Statedef 0]
type = ${targetStateType}
movetype = I
physics = ${targetStateType === 'A' ? 'A' : 'S'}
[Statedef 200]
type = S
movetype = A
physics = S
[State 200, Hit]
type = HitDef
trigger1 = 1
damage = ${damage}, 0
${hitTimeLines}
${animTypeLine}
`);
  const initial = createInitialGameState();
  const attackerIndex = attackerId - 1;
  const targetIndex = attackerId === 1 ? 1 : 0;
  const players = [...initial.players] as typeof initial.players;
  players[attackerIndex] = {
    ...players[attackerIndex],
    x: attackerId === 1 ? 240 : 290,
    facing: attackerId === 1 ? 1 : -1,
    stateNo: 200,
    animNo: 200,
    moveType: 'A',
  };
  players[targetIndex] = {
    ...players[targetIndex],
    x: attackerId === 1 ? 290 : 240,
    animNo: 0,
    stateType: targetStateType,
    physics: targetStateType === 'A' ? 'A' : 'S',
  };
  const runtime = stepCnsStateRuntime({ ...initial, players }, cns).state;
  return resolveFallbackHits(runtime, airDocument);
}
