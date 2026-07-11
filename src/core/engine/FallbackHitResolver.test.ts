import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { createInitialGameState } from './GameState';
import { resolveFallbackHits } from './FallbackHitResolver';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';

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

describe('FallbackHitResolver', () => {
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

    expect(next.hitEvents).toHaveLength(1);
    expect(next.hitDiagnosticLines).toEqual([]);
  });

  it('applies fallback hit when attack Clsn overlaps body Clsn', () => {
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

    expect(next.hitEvents).toHaveLength(1);
    expect(next.players[1].life).toBe(940);
    expect(next.players[1].stateNo).toBe(5000);
    expect(next.players[0].hitDefUsed).toBe(true);
    expect(next.hitDiagnosticLines?.join('\n')).toContain('source=existing_fallback fallbackReason=active_hitdef_missing result=hit');
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
