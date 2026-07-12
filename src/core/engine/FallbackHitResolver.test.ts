import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { createInitialGameState } from './GameState';
import { resolveFallbackHits } from './FallbackHitResolver';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { applyFallbackHitRecovery } from './FallbackHitRecovery';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { evaluateCnsRuntimeTrigger } from '../cns/CnsRuntimeTrigger';

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
  it('stores the contact GetHitVar snapshot and uses it in later get-hit states', () => {
    const hit = resolveConfiguredHit({ damage: 100, groundHitTime: 20, animType: 'Medium', groundVelocity: [-4, -1], pauseTime: [0, 0] });
    expect(hit.players[1].getHitVars).toMatchObject({
      damage: 100, hittime: 20, slidetime: 20, ctrltime: 20,
      xveladd: -4, yveladd: -1, xvel: -4, yvel: -1,
      type: 0, animtype: 1, airtype: 0, groundtype: 0,
      fall: 0, 'fall.damage': 0, 'fall.recover': 1,
      hitid: 0, chainid: -1, guarded: 0, yaccel: 0.6,
    });
    const cns = parseCnsText(`
[Statedef 5000]
type = S
movetype = H
physics = N
[State 5000, Medium Anim]
type = ChangeAnim
trigger1 = GetHitVar(animtype) = 1
value = 5001
[State 5000, Continue]
type = ChangeState
trigger1 = GetHitVar(hittime) = 20
value = 5001
[Statedef 5001]
type = S
movetype = H
physics = S
`);
    const stepped = stepCnsStateRuntime(hit, cns).state;
    expect(stepped.players[1]).toMatchObject({ stateNo: 5001, animNo: 5001 });
    expect(stepped.players[1].getHitVars).toEqual(hit.players[1].getHitVars);
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('raw.gethitvar_snapshot target=p2');
  });

  it('preserves out-of-scope Back as GetHitVar(animtype)=3 without changing Issue #1 fallback Anim', () => {
    const hit = resolveConfiguredHit({ animType: 'Back' });
    expect(hit.players[1].animNo).toBe(5000);
    expect(hit.players[1].getHitVars?.animtype).toBe(3);
  });
  it.each([
    [[2, 5] as [number, number], 2, 5],
    [[0, 0] as [number, number], 0, 0],
  ])('applies distinct HitDef pausetime %j counters', (pauseTime, attackerFrames, defenderFrames) => {
    const hit = resolveConfiguredHit({ pauseTime });
    expect(hit.players[0].hitPause).toBe(attackerFrames);
    expect(hit.players[1].hitPause).toBe(defenderFrames);
    expect(hit.hitDiagnosticLines?.join('\n')).toContain(`attackerFrames=${attackerFrames} defenderFrames=${defenderFrames} source=active_hitdef`);
  });

  it('snapshots down.velocity and down.hittime for the common down path', () => {
    const hit = resolveConfiguredHit({ targetStateType: 'A', fall: true, downVelocity: [-1.5, -3], downHitTime: 11 });
    expect(hit.players[0].activeHitDef).toMatchObject({ downVelocity: { x: -1.5, y: -3 }, downHitTime: 11 });
    expect(hit.players[1].getHitVars).toMatchObject({ 'down.xvel': -1.5, 'down.yvel': -3, 'down.hittime': 11 });
    expect(hit.players[1].hitFallVelocity).toEqual({ x: -1.5, y: -3 });
  });

  it('consumes StateDef juggle only for an airborne target and rejects a new HitDef when points are insufficient', () => {
    const first = resolveConfiguredHit({ targetStateType: 'A', juggle: 6, airJuggle: 10, pauseTime: [0, 0] });
    expect(first.players[1]).toMatchObject({ life: 963, juggleMax: 10, juggleRemaining: 4 });
    expect(first.hitDiagnosticLines?.join('\n')).toContain('cost=6 before=10 after=4 max=10 result=accepted');

    const duplicate = resolveFallbackHits(first, air);
    expect(duplicate.players[1].juggleRemaining).toBe(4);

    const active = first.players[0].activeHitDef!;
    const rejected = resolveFallbackHits({
      ...first,
      players: [
        { ...first.players[0], hitPause: 0, hitDefUsed: false, hitTargets: [], activeHitDef: { ...active, diagnosticId: (active.diagnosticId ?? 0) + 1 } },
        { ...first.players[1], hitPause: 0, animNo: 0 },
      ],
    }, air);
    expect(rejected.hitEvents).toHaveLength(0);
    expect(rejected.players[1]).toMatchObject({ life: 963, juggleRemaining: 4 });
    expect(rejected.hitDiagnosticLines?.join('\n')).toContain('result=rejected reason=juggle_insufficient');
  });

  it('does not consume or reject juggle points for an ordinary grounded hit', () => {
    const hit = resolveConfiguredHit({ targetStateType: 'S', juggle: 20, airJuggle: 10, pauseTime: [0, 0] });
    expect(hit.hitEvents).toHaveLength(1);
    expect(hit.players[1].life).toBe(963);
    expect(hit.players[1].juggleRemaining).toBe(10);
    expect(hit.hitDiagnosticLines?.join('\n')).not.toContain('raw.hit_juggle');
  });

  it.each([
    ['S', 'H', ['holdback'], 150],
    ['S', 'L', ['holdback', 'holddown'], 152],
    ['A', 'A', ['holdback'], 154],
  ] as const)('guards a %s target when guardflag=%s permits its guard kind', (targetStateType, guardFlag, commands, guardState) => {
    const hit = resolveConfiguredHit({
      targetStateType, guardFlag, targetCommands: new Set(commands), guardDamage: 5,
      guardVelocity: [-2, 0], guardPauseTime: [0, 0], guardHitTime: 6,
    });
    expect(hit.players[1]).toMatchObject({ stateNo: guardState, life: 995, ctrl: false, vx: -2 });
    expect(hit.players[1].getHitVars?.guarded).toBe(1);
    expect(hit.players[0].moveContact).toMatchObject({ contact: true, hit: false, guarded: true, hitCount: 0 });
    expect(hit.hitDiagnosticLines?.join('\n')).toContain(`kind=${guardState === 150 ? 'stand' : guardState === 152 ? 'crouch' : 'air'}`);
  });

  it.each([1, -1] as const)('uses Facing-relative holdback intent and guard velocity for attacker facing %i', (attackerFacing) => {
    const hit = resolveConfiguredHit({
      guardFlag: 'H', targetCommands: new Set(['holdback']), attackerFacing,
      guardVelocity: [-2, 0], guardPauseTime: [0, 0],
    });
    const targetIndex = 1;
    expect(hit.players[targetIndex]).toMatchObject({ stateNo: 150, vx: -2 * attackerFacing });
  });

  it('does not guard without holdback or when guardflag/state kind and guard distance do not permit it', () => {
    const noInput = resolveConfiguredHit({ guardFlag: 'H', guardDamage: 5, guardPauseTime: [0, 0] });
    expect(noInput.players[1]).toMatchObject({ stateNo: 5000, life: 963 });
    expect(noInput.players[0].moveContact?.hit).toBe(true);

    const wrongFlag = resolveConfiguredHit({ guardFlag: 'L', targetCommands: new Set(['holdback']), guardDamage: 5, guardPauseTime: [0, 0] });
    expect(wrongFlag.players[1]).toMatchObject({ stateNo: 5000, life: 963 });
    expect(wrongFlag.hitDiagnosticLines?.join('\n')).toContain('reason=guardflag_mismatch');

    const tooFar = resolveConfiguredHit({ guardFlag: 'H', guardDistance: 30, targetCommands: new Set(['holdback']), guardDamage: 5, guardPauseTime: [0, 0] });
    expect(tooFar.players[1]).toMatchObject({ stateNo: 5000, life: 963 });
    expect(tooFar.hitDiagnosticLines?.join('\n')).toContain('reason=out_of_guard_distance');
  });

  it('uses guard.damage independently and honors guard.kill=false', () => {
    const guarded = resolveConfiguredHit({
      targetLife: 10, damage: 7, guardDamage: 20, guardKill: false, guardFlag: 'H',
      targetCommands: new Set(['holdback']), guardPauseTime: [0, 0],
    });
    expect(guarded.players[1]).toMatchObject({ stateNo: 150, life: 1 });
    expect(guarded.hitEvents[0].damage).toBe(20);
    expect(guarded.players[1].getHitVars).toMatchObject({ damage: 20, guarded: 1 });

    const normal = resolveConfiguredHit({ targetLife: 10, damage: 7, guardDamage: 20, guardKill: false, guardFlag: 'H', guardPauseTime: [0, 0] });
    expect(normal.players[1]).toMatchObject({ stateNo: 5000, life: 3 });

    const lethalGuard = resolveConfiguredHit({
      targetLife: 10, guardDamage: 20, guardKill: true, guardFlag: 'H',
      targetCommands: new Set(['holdback']), guardPauseTime: [0, 0],
    });
    expect(lethalGuard.players[1].life).toBe(0);
  });

  it.each([
    ['S', 'I', 'H', true], ['S', 'I', 'L', false],
    ['C', 'I', 'L', true], ['C', 'I', 'H', false],
    ['A', 'I', 'A', true], ['A', 'I', 'M', false],
    ['A', 'H', 'F', true], ['A', 'H', 'A', false],
    ['L', 'H', 'D', true], ['L', 'H', 'M', false],
  ] as const)('matches hitflag for StateType=%s MoveType=%s flag=%s', (targetStateType, targetMoveType, hitFlag, accepted) => {
    const result = resolveConfiguredHit({ targetStateType, targetMoveType, hitFlag, pauseTime: [0, 0] });
    expect(result.hitEvents.length > 0).toBe(accepted);
    expect(result.players[1].life).toBe(accepted ? 963 : 1000);
    if (!accepted) expect(result.hitDiagnosticLines?.join('\n')).toContain('reason=hitflag_state_mismatch');
  });

  it('rejects unsupported hitflag modifiers instead of treating them as always-hit', () => {
    const result = resolveConfiguredHit({ hitFlag: 'M-', pauseTime: [0, 0] });
    expect(result.hitEvents).toHaveLength(0);
    expect(result.hitDiagnosticLines?.join('\n')).toContain('reason=unsupported_hitflag_modifier');
  });

  it('uses normalized attr for HitBy/NotHitBy filtering and rejects invalid attr', () => {
    const allowed = resolveConfiguredHit({ attr: 'S, NA', targetHitBy: 'SCA, NA', pauseTime: [0, 0] });
    expect(allowed.hitEvents).toHaveLength(1);

    const notAllowed = resolveConfiguredHit({ attr: 'S, SA', targetHitBy: 'SCA, NA', pauseTime: [0, 0] });
    expect(notAllowed.hitEvents).toHaveLength(0);
    expect(notAllowed.hitDiagnosticLines?.join('\n')).toContain('reason=attr_not_allowed');

    const blocked = resolveConfiguredHit({ attr: 'A, NP', targetNotHitBy: 'SCA, NP, SP', pauseTime: [0, 0] });
    expect(blocked.hitEvents).toHaveLength(0);
    expect(blocked.hitDiagnosticLines?.join('\n')).toContain('reason=attr_blocked');

    const invalid = resolveConfiguredHit({ attr: 'X, ???', pauseTime: [0, 0] });
    expect(invalid.hitEvents).toHaveLength(0);
    expect(invalid.hitDiagnosticLines?.join('\n')).toContain('reason=invalid_attr');
  });

  it('allows an equal Hit-priority trade and resolves unequal priorities without P1 order bias', () => {
    const trade = resolveSimultaneousHits([4, 'Hit'], [4, 'Hit']);
    expect(trade.hitEvents).toHaveLength(2);
    expect(trade.players.map((player) => player.life)).toEqual([963, 963]);
    expect(trade.players.every((player) => player.moveContact?.hit)).toBe(true);
    expect(trade.hitDiagnosticLines?.join('\n')).toContain('reason=equal_hit_trade');

    const p1Wins = resolveSimultaneousHits([5, 'Hit'], [3, 'Hit']);
    expect(p1Wins.hitEvents).toHaveLength(1);
    expect(p1Wins.players.map((player) => player.life)).toEqual([1000, 963]);
    expect(p1Wins.hitDiagnosticLines?.join('\n')).toContain('reason=higher_priority');

    const p2Wins = resolveSimultaneousHits([2, 'Hit'], [6, 'Hit']);
    expect(p2Wins.hitEvents).toHaveLength(1);
    expect(p2Wins.players.map((player) => player.life)).toEqual([963, 1000]);
  });

  it.each(['Miss', 'Dodge'])('diagnoses equal %s priority types as no-contact instead of silently hitting', (type) => {
    const result = resolveSimultaneousHits([4, type], [4, type]);
    expect(result.hitEvents).toHaveLength(0);
    expect(result.players.map((player) => player.life)).toEqual([1000, 1000]);
    expect(result.hitDiagnosticLines?.join('\n')).toContain('reason=equal_non_hit_miss');
  });

  it('applies p1stateno and p2stateno with explicit custom-state ownership', () => {
    const p1Only = resolveConfiguredHit({ p1StateNo: 300, pauseTime: [0, 0] });
    expect(p1Only.players[0]).toMatchObject({ stateNo: 300, stateOwnerId: 1 });
    expect(p1Only.players[1]).toMatchObject({ stateNo: 5000, stateOwnerId: 2 });

    const selfOwned = resolveConfiguredHit({ p2StateNo: 700, p2GetP1State: false, pauseTime: [0, 0] });
    expect(selfOwned.players[1]).toMatchObject({ stateNo: 700, stateOwnerId: 2 });

    const borrowed = resolveConfiguredHit({ p2StateNo: 700, p2GetP1State: true, pauseTime: [0, 0] });
    expect(borrowed.players[1]).toMatchObject({ stateNo: 700, stateOwnerId: 1 });
    expect(borrowed.hitDiagnosticLines?.join('\n')).toContain('p2stateno=700 p2Owner=1 p2getp1state=1');
  });

  it('applies forcestand independently of custom-state ownership', () => {
    const result = resolveConfiguredHit({ targetStateType: 'A', hitFlag: 'A', p2StateNo: 700, p2GetP1State: true, forceStand: true, pauseTime: [0, 0] });
    expect(result.players[1]).toMatchObject({ stateNo: 700, stateOwnerId: 1, stateType: 'S' });
  });

  it.each([
    [1, 300],
    [-1, 230],
  ] as const)('generates one normal hit effect envelope at the Clsn contact with Facing %i', (attackerFacing, expectedX) => {
    const result = resolveConfiguredHit({
      attackerFacing, sparkNo: 'S5001', sparkXY: [10, -5], hitSound: 'S1, 2',
      envShake: [6, 90, -4, 30], pauseTime: [0, 0],
    });
    expect(result.hitEvents).toHaveLength(1);
    expect(result.hitEvents[0]).toMatchObject({
      guarded: false,
      spark: { animNo: 5001, scope: 'attacker', x: expectedX, y: 235, available: true },
      sound: { group: 1, index: 2, scope: 'attacker' },
      envShake: { time: 6, frequency: 90, amplitude: -4, phase: 30 },
    });
    expect(result.hitDiagnosticLines?.join('\n')).toContain('kind=hit spark=attacker:5001');

    const duplicate = resolveFallbackHits({
      ...result,
      players: [{ ...result.players[0], hitPause: 0 }, { ...result.players[1], hitPause: 0, animNo: 0 }],
    }, air);
    expect(duplicate.hitEvents).toHaveLength(0);
  });

  it('separates guard spark/sound from normal hit effects', () => {
    const result = resolveConfiguredHit({
      guardFlag: 'H', targetCommands: new Set(['holdback']), guardDamage: 2,
      sparkNo: 'S5001', guardSparkNo: 'S5002', hitSound: 'S1, 2', guardSound: 'S3, 4',
      sparkXY: [0, 0], guardPauseTime: [0, 0],
    });
    expect(result.hitEvents[0]).toMatchObject({
      guarded: true,
      spark: { animNo: 5002, scope: 'attacker', available: true },
      sound: { group: 3, index: 4, scope: 'attacker' },
    });
    expect(result.hitDiagnosticLines?.join('\n')).toContain('kind=guard spark=attacker:5002');
  });

  it('keeps missing effect assets safe and diagnoses unavailable animation/audio runtime', () => {
    const result = resolveConfiguredHit({ sparkNo: 'S9999', hitSound: 'S99, 1', pauseTime: [0, 0] });
    expect(result.hitEvents[0].spark).toMatchObject({ animNo: 9999, available: false });
    const diagnostics = result.hitDiagnosticLines?.join('\n') ?? '';
    expect(diagnostics).toContain('warning=missing_animation');
    expect(diagnostics).toContain('limitation=audio_runtime_unavailable');
  });

  it('freezes motion and timers for exactly the defender pausetime then resumes', () => {
    let state = resolveConfiguredHit({ pauseTime: [0, 2], groundVelocity: [-4, 0] });
    const targetAtHit = state.players[1];
    state = stepCnsPhysicsMotion(state);
    expect(state.players[1]).toMatchObject({ x: targetAtHit.x, stateTime: targetAtHit.stateTime, animTime: targetAtHit.animTime, hitPause: 1 });
    state = stepCnsPhysicsMotion(state);
    expect(state.players[1]).toMatchObject({ x: targetAtHit.x, stateTime: targetAtHit.stateTime, animTime: targetAtHit.animTime, hitPause: 0 });
    state = stepCnsPhysicsMotion(state);
    expect(state.players[1].x).toBe(targetAtHit.x + 4);
    expect(state.players[1].stateTime).toBe(targetAtHit.stateTime + 1);
    expect(state.players[1].animTime).toBe(targetAtHit.animTime + 1);
  });
  it.each([
      [1, 6],
      [-1, -6],
  ] as const)('applies ground.velocity relative to attacker facing %i', (facing, expectedX) => {
    const hit = resolveConfiguredHit({ groundVelocity: [-6, -2], attackerFacing: facing });
    expect(hit.players[1]).toMatchObject({ vx: expectedX, vy: -2 });
    expect(hit.hitDiagnosticLines?.join('\n')).toContain(`velocity=(${expectedX},-2) source=active_hitdef velocityKind=ground attackerFacing=${facing}`);
  });

  it('selects air.velocity from target StateType at contact', () => {
    const hit = resolveConfiguredHit({ groundVelocity: [-3, 0], airVelocity: [-2.5, -7], targetStateType: 'A' });
    expect(hit.players[1]).toMatchObject({ vx: 2.5, vy: -7 });
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('velocity=(2.5,-7) source=active_hitdef velocityKind=air');
  });

  it('preserves an explicit zero velocity and moves only after hit pause ends', () => {
    const stopped = resolveConfiguredHit({ groundVelocity: [0, 0] });
    expect(stopped.players[1]).toMatchObject({ vx: 0, vy: 0 });

    const moving = resolveConfiguredHit({ groundVelocity: [-4, -1] });
    const targetBefore = { ...moving.players[1], hitPause: 0 };
    const stepped = stepCnsPhysicsMotion({ ...moving, players: [moving.players[0], targetBefore] });
    expect(stepped.players[1].x).toBe(targetBefore.x + 4);
    expect(stepped.players[1].vx).not.toBe(0);
  });
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

  it('routes an airborne target through State 5020 without applying grounded animtype', () => {
    const hit = resolveConfiguredHit({ animType: 'Hard', targetStateType: 'A' });
    expect(hit.players[1].animNo).toBe(5000);
    expect(hit.players[1].stateNo).toBe(5020);
    expect(hit.players[1].stateType).toBe('A');
    expect(hit.players[1].hitStun?.targetStateTypeAtHit).toBe('A');
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('fallbackReason=missing_air_animtype');
  });

  it.each([
      [1, 3],
      [-1, -3],
  ] as const)('applies air.animtype, air velocity, and fall data with attacker facing %i', (attackerFacing, expectedX) => {
    const hit = resolveConfiguredHit({
      targetStateType: 'A', airAnimType: 'Hard', airHitTime: 17, airVelocity: [-3, -6],
      fall: true, fallVelocity: [-2, -4], fallRecover: false, fallRecoverTime: 9, attackerFacing,
    });
    expect(hit.players[1]).toMatchObject({
      stateNo: 5020, stateType: 'A', animNo: 5002, vx: expectedX, vy: -6,
      hitVelX: expectedX, hitVelY: -6, hitFall: true, fallRecover: false, fallRecoverTime: 9,
    });
    expect(hit.players[1].hitFallVelocity).toEqual({ x: attackerFacing * -2, y: -4 });
    expect(hit.players[1].hitStun).toMatchObject({ selectedHitTime: 17, kind: 'air' });
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('state=5020 source=air_common_state');
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
    expect(next.hitDiagnosticLines?.join('\n')).toContain('activeHitDefId=901 lifeBefore=20 appliedDamage=37 lifeAfter=0 source=active_hitdef kill=1 ko=1');
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
    expect(hit.players[0].moveContact).toMatchObject({ contact: true, hit: true, guarded: false, hitCount: 1 });
  });

  it('drives a MoveHit cancel route from real contact state', () => {
    const hit = resolveConfiguredHit({ pauseTime: [0, 0] });
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
[State 200, Hit confirm]
type = ChangeState
trigger1 = MoveContact && MoveHit && !MoveGuarded
trigger1 = HitCount = 1
value = 300
[Statedef 300]
type = S
movetype = A
`);
    const next = stepCnsStateRuntime(hit, cns).state;
    expect(next.players[0].stateNo).toBe(300);
  });

  it('registers a selectable Target and exposes NumTarget/TargetID/TargetStateNo', () => {
    const hit = resolveConfiguredHit({ hitId: 42, pauseTime: [0, 0] });
    expect(hit.players[0].targets).toEqual([{ playerId: 2, hitDefId: 42, activeHitDefId: hit.players[0].activeHitDef?.diagnosticId }]);
    for (const expression of ['NumTarget = 1', 'NumTarget(42) = 1', 'TargetID(42) = 2', 'TargetStateNo(42) = 5000']) {
      expect(evaluateCnsRuntimeTrigger(expression, { player: hit.players[0], opponent: hit.players[1] }), expression).toBe(true);
    }
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
[State 200, Target confirmed]
type = ChangeState
trigger1 = NumTarget = 1
trigger1 = NumTarget(42) = 1
trigger1 = TargetID(42) = 2
trigger1 = TargetStateNo(42) = 5000
value = 301
[Statedef 301]
type = S
movetype = A
`);
    expect(stepCnsStateRuntime(hit, cns).state.players[0].stateNo).toBe(301);
  });

  it('does not retain a Target when the hit KOs it', () => {
    const hit = resolveConfiguredHit({ damage: 1000, hitId: 9 });
    expect(hit.players[1].life).toBe(0);
    expect(hit.players[0].targets).toEqual([]);
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('registered=0 reason=target_ko');
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

  it('records one hit for five overlapping frames per ActiveHitDef and defender', () => {
    let state = resolveConfiguredHit({ damage: 25, groundHitTime: 7 });
    const lifeAfterFirst = state.players[1].life;
    let additionalEvents = 0;
    for (let frame = 0; frame < 4; frame += 1) {
      state = resolveFallbackHits({
        ...state,
        players: [{ ...state.players[0], hitPause: 0 }, { ...state.players[1], hitPause: 0, animNo: 0 }],
      }, air);
      additionalEvents += state.hitEvents.length;
    }
    expect(additionalEvents).toBe(0);
    expect(state.players[1].life).toBe(lifeAfterFirst);
    expect(state.players[0].hitTargets).toHaveLength(1);
  });

  it('allows the same defender to be hit by a new ActiveHitDef generation', () => {
    const first = resolveConfiguredHit({ damage: 25 });
    const previous = first.players[0].activeHitDef!;
    const second = resolveFallbackHits({
      ...first,
      players: [{
        ...first.players[0], hitPause: 0,
        activeHitDef: { ...previous, diagnosticId: (previous.diagnosticId ?? 0) + 1, rejectedLogged: false },
      }, { ...first.players[1], hitPause: 0, animNo: 0 }],
    }, air);
    expect(second.hitEvents).toHaveLength(1);
    expect(second.players[1].life).toBe(first.players[1].life - 25);
    expect(second.players[0].hitTargets).toHaveLength(2);
    expect(second.players[0].moveContact?.hitCount).toBe(2);
  });

  it('allows new ActiveHitDef generations with the same or different HitDef id', () => {
    const first = resolveConfiguredHit({ damage: 25, hitId: 10, pauseTime: [0, 0] });
    const previous = first.players[0].activeHitDef!;
    const sameId = resolveFallbackHits({
      ...first,
      players: [{
        ...first.players[0],
        activeHitDef: { ...previous, diagnosticId: (previous.diagnosticId ?? 0) + 1, rejectedLogged: false },
      }, { ...first.players[1], hitPause: 0, animNo: 0 }],
    }, air);
    expect(sameId.hitEvents).toHaveLength(1);
    expect(sameId.players[1].life).toBe(first.players[1].life - 25);

    const differentId = resolveFallbackHits({
      ...first,
      players: [{
        ...first.players[0],
        activeHitDef: { ...previous, hitId: 11, diagnosticId: (previous.diagnosticId ?? 0) + 2, rejectedLogged: false },
      }, { ...first.players[1], hitPause: 0, animNo: 0 }],
    }, air);
    expect(differentId.hitEvents).toHaveLength(1);
    expect(differentId.players[1].life).toBe(first.players[1].life - 25);
  });

  it('uses hitonce only to prevent one generation from affecting another target', () => {
    const hitOnce = resolveConfiguredHit({ damage: 25, hitId: 10, hitOnce: true, pauseTime: [0, 0] });
    const active = hitOnce.players[0].activeHitDef!;
    const consumedElsewhere: ReturnType<typeof resolveConfiguredHit> = {
      ...hitOnce,
      players: [{
        ...hitOnce.players[0],
        hitTargets: [{ activeHitDefId: active.diagnosticId!, defenderId: 99, hitDefId: 10 }],
      }, { ...hitOnce.players[1], hitPause: 0, animNo: 0 }],
    };
    const rejected = resolveFallbackHits(consumedElsewhere, air);
    expect(rejected.hitEvents).toHaveLength(0);
    expect(rejected.hitDiagnosticLines?.join('\n')).toContain('reason=hitonce_already_consumed');

    const multiTarget = resolveFallbackHits({
      ...consumedElsewhere,
      players: [{
        ...consumedElsewhere.players[0],
        activeHitDef: { ...active, hitOnce: false, rejectedLogged: false },
      }, consumedElsewhere.players[1]],
    }, air);
    expect(multiTarget.hitEvents).toHaveLength(1);
  });

  it('accepts only matching chainid history and rejects nochainid history', () => {
    const first = resolveConfiguredHit({ damage: 25, hitId: 10, pauseTime: [0, 0] });
    const previous = first.players[0].activeHitDef!;
    const tryChain = (chainId: number | undefined, noChainIds: number[] = []) => resolveFallbackHits({
      ...first,
      players: [{
        ...first.players[0],
        activeHitDef: {
          ...previous, hitId: 20, chainId, noChainIds,
          diagnosticId: (previous.diagnosticId ?? 0) + 1, rejectedLogged: false,
        },
      }, { ...first.players[1], hitPause: 0, animNo: 0 }],
    }, air);

    const matching = tryChain(10);
    expect(matching.hitEvents).toHaveLength(1);
    expect(matching.hitDiagnosticLines?.join('\n')).toContain('previous=10 hitonce=0 result=accepted reason=chainid_match');

    const mismatch = tryChain(9);
    expect(mismatch.hitEvents).toHaveLength(0);
    expect(mismatch.hitDiagnosticLines?.join('\n')).toContain('result=rejected reason=chainid_mismatch');

    const excluded = tryChain(undefined, [10]);
    expect(excluded.hitEvents).toHaveLength(0);
    expect(excluded.hitDiagnosticLines?.join('\n')).toContain('result=rejected reason=nochainid_match');

    const afterThirdParty = resolveFallbackHits({
      ...first,
      players: [{
        ...first.players[0],
        activeHitDef: {
          ...previous, hitId: 20, noChainIds: [10],
          diagnosticId: (previous.diagnosticId ?? 0) + 2, rejectedLogged: false,
        },
      }, { ...first.players[1], hitPause: 0, animNo: 0, lastHitAttackerId: 99 }],
    }, air);
    expect(afterThirdParty.hitEvents).toHaveLength(1);
    expect(afterThirdParty.hitDiagnosticLines?.join('\n')).toContain('nochainid=10 previous=-');
  });

  it('separates normal kill from guard.kill and prevents normal KO when kill=0', () => {
    const nonLethal = resolveConfiguredHit({ targetLife: 10, damage: 20, kill: false, pauseTime: [0, 0] });
    expect(nonLethal.players[1].life).toBe(1);
    expect(nonLethal.hitDiagnosticLines?.join('\n')).toContain('kill=0 ko=0');

    const lethal = resolveConfiguredHit({ targetLife: 10, damage: 20, kill: true, pauseTime: [0, 0] });
    expect(lethal.players[1].life).toBe(0);
    expect(lethal.hitDiagnosticLines?.join('\n')).toContain('kill=1 ko=1');
  });

  it('applies explicit hit/guard getpower and givepower once and clamps the gauges', () => {
    const hit = resolveConfiguredHit({
      getPower: [120, 30], givePower: [-50, 10], attackerPower: 2950, targetPower: 40, pauseTime: [0, 0],
    });
    expect(hit.players[0].power).toBe(3000);
    expect(hit.players[1].power).toBe(0);
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('getpower=120 attackerBefore=2950 attackerAfter=3000');

    const duplicate = resolveFallbackHits({
      ...hit,
      players: [hit.players[0], { ...hit.players[1], hitPause: 0, animNo: 0 }],
    }, air);
    expect(duplicate.players[0].power).toBe(3000);
    expect(duplicate.players[1].power).toBe(0);

    const guard = resolveConfiguredHit({
      getPower: [120, 30], givePower: [-50, 10], attackerPower: 100, targetPower: 100,
      guardFlag: 'H', targetCommands: new Set(['holdback']), guardPauseTime: [0, 0],
    });
    expect(guard.players[0].power).toBe(130);
    expect(guard.players[1].power).toBe(110);
    expect(guard.hitDiagnosticLines?.join('\n')).toContain('kind=guard getpower=30');
  });

  it('uses numhits for the defender combo count without changing attacker HitCount or contact damage', () => {
    const hit = resolveConfiguredHit({ damage: 25, numHits: 3, pauseTime: [0, 0] });
    expect(hit.players[0].moveContact?.hitCount).toBe(1);
    expect(hit.players[1].comboHitCount).toBe(3);
    expect(hit.players[1].getHitVars?.hitcount).toBe(3);
    expect(hit.players[1].life).toBe(975);
    expect(hit.hitEvents).toHaveLength(1);
  });

  it('applies selected cornerpush only while the target is at a fallback stage edge', () => {
    const edge = resolveConfiguredHit({
      attackerX: 862, targetX: 912, groundCornerPush: -6, pauseTime: [0, 0],
    });
    expect(edge.players[0].vx).toBe(-6);
    expect(edge.hitDiagnosticLines?.join('\n')).toContain('kind=ground atEdge=1 veloff=-6');

    const middle = resolveConfiguredHit({ groundCornerPush: -6, pauseTime: [0, 0] });
    expect(middle.players[0].vx).toBe(0);
    expect(middle.hitDiagnosticLines?.join('\n')).toContain('result=skipped reason=target_not_at_edge');

    const guarded = resolveConfiguredHit({
      attackerX: 862, targetX: 912, guardCornerPush: -4, guardFlag: 'H',
      targetCommands: new Set(['holdback']), guardPauseTime: [0, 0],
    });
    expect(guarded.players[0].vx).toBe(-4);
    expect(guarded.hitDiagnosticLines?.join('\n')).toContain('kind=guard atEdge=1 veloff=-4');
  });

  it.each([
    { kind: 'air', targetStateType: 'A' as const, hitFlag: 'A', options: { airCornerPush: -5 } },
    { kind: 'down', targetStateType: 'L' as const, hitFlag: 'D', options: { downCornerPush: -4 } },
  ])('selects $kind cornerpush for the target contact class', ({ kind, targetStateType, hitFlag, options }) => {
    const hit = resolveConfiguredHit({
      attackerX: 862, targetX: 912, targetStateType, hitFlag, pauseTime: [0, 0], ...options,
    });
    expect(hit.players[0].vx).toBe(Object.values(options)[0]);
    expect(hit.hitDiagnosticLines?.join('\n')).toContain(`kind=${kind} atEdge=1`);
  });

  it('selects airguard.cornerpush.veloff for an airborne guard', () => {
    const guarded = resolveConfiguredHit({
      attackerX: 862, targetX: 912, targetStateType: 'A', guardFlag: 'A', airGuardCornerPush: -2,
      targetCommands: new Set(['holdback']), guardPauseTime: [0, 0],
    });
    expect(guarded.players[0].vx).toBe(-2);
    expect(guarded.hitDiagnosticLines?.join('\n')).toContain('kind=guard atEdge=1 veloff=-2');
  });

  it.each([1, -1] as const)('applies snap and sprite priorities relative to Facing %i', (attackerFacing) => {
    const hit = resolveConfiguredHit({
      attackerFacing, attackerX: 400, targetX: attackerFacing === 1 ? 450 : 350,
      snap: [30, -10], p1SprPriority: 7, p2SprPriority: 3, pauseTime: [0, 0],
    });
    const attacker = hit.players[attackerFacing === 1 ? 0 : 0];
    const target = hit.players[1];
    expect(target.x).toBe(400 + 30 * attackerFacing);
    expect(target.y).toBe(275);
    expect(target.getHitVars).toMatchObject({ xoff: 30, yoff: -10 });
    expect(attacker.sprPriority).toBe(7);
    expect(target.sprPriority).toBe(3);
    expect(hit.hitDiagnosticLines?.join('\n')).toContain(`offset=30,-10 facing=${attackerFacing}`);
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
  groundVelocity,
  airVelocity,
  attackerFacing,
  pauseTime,
  hitId,
  hitOnce,
  kill,
  getPower,
  givePower,
  numHits,
  groundCornerPush,
  airCornerPush,
  downCornerPush,
  guardCornerPush,
  airGuardCornerPush,
  snap,
  p1SprPriority,
  p2SprPriority,
  attackerPower,
  targetPower,
  attackerX,
  targetX,
  airAnimType,
  fall,
  fallVelocity,
  fallRecover,
  fallRecoverTime,
  downVelocity,
  downHitTime,
  juggle,
  airJuggle,
  guardFlag,
  guardDamage,
  guardKill,
  guardControlTime,
  guardVelocity,
  guardPauseTime,
  guardHitTime,
  guardDistance,
  targetCommands,
  targetLife,
  hitFlag,
  attr,
  targetHitBy,
  targetNotHitBy,
  targetMoveType = 'I',
  p1StateNo,
  p2StateNo,
  p2GetP1State,
  forceStand,
  sparkNo,
  guardSparkNo,
  sparkXY,
  hitSound,
  guardSound,
  envShake,
}: {
  damage?: number;
  groundHitTime?: number;
  airHitTime?: number;
  targetStateType?: 'S' | 'C' | 'A' | 'L';
  attackerId?: 1 | 2;
  animType?: string;
  airDocument?: typeof air;
  groundVelocity?: [number, number];
  airVelocity?: [number, number];
  attackerFacing?: 1 | -1;
  pauseTime?: [number, number];
  hitId?: number;
  hitOnce?: boolean;
  kill?: boolean;
  getPower?: [number, number];
  givePower?: [number, number];
  numHits?: number;
  groundCornerPush?: number;
  airCornerPush?: number;
  downCornerPush?: number;
  guardCornerPush?: number;
  airGuardCornerPush?: number;
  snap?: [number, number];
  p1SprPriority?: number;
  p2SprPriority?: number;
  attackerPower?: number;
  targetPower?: number;
  attackerX?: number;
  targetX?: number;
  airAnimType?: string;
  fall?: boolean;
  fallVelocity?: [number, number];
  fallRecover?: boolean;
  fallRecoverTime?: number;
  downVelocity?: [number, number];
  downHitTime?: number;
  juggle?: number;
  airJuggle?: number;
  guardFlag?: string;
  guardDamage?: number;
  guardKill?: boolean;
  guardControlTime?: number;
  guardVelocity?: [number, number];
  guardPauseTime?: [number, number];
  guardHitTime?: number;
  guardDistance?: number;
  targetCommands?: ReadonlySet<string>;
  targetLife?: number;
  hitFlag?: string;
  attr?: string;
  targetHitBy?: string;
  targetNotHitBy?: string;
  targetMoveType?: 'I' | 'H';
  p1StateNo?: number;
  p2StateNo?: number;
  p2GetP1State?: boolean;
  forceStand?: boolean;
  sparkNo?: string | number;
  guardSparkNo?: string | number;
  sparkXY?: [number, number];
  hitSound?: string;
  guardSound?: string;
  envShake?: [number, number, number, number];
}) {
  const hitTimeLines = [
    groundHitTime === undefined ? '' : `ground.hittime = ${groundHitTime}`,
    airHitTime === undefined ? '' : `air.hittime = ${airHitTime}`,
  ].filter(Boolean).join('\n');
  const animTypeLine = animType === undefined ? '' : `animtype = ${animType}`;
  const velocityLines = [
    groundVelocity ? `ground.velocity = ${groundVelocity.join(', ')}` : '',
    airVelocity ? `air.velocity = ${airVelocity.join(', ')}` : '',
  ].filter(Boolean).join('\n');
  const pauseTimeLine = pauseTime ? `pausetime = ${pauseTime.join(', ')}` : '';
  const hitIdLine = hitId === undefined ? '' : `id = ${hitId}`;
  const hitOnceLine = hitOnce === undefined ? '' : `hitonce = ${hitOnce ? 1 : 0}`;
  const auxiliaryLines = [
    kill === undefined ? '' : `kill = ${kill ? 1 : 0}`,
    getPower === undefined ? '' : `getpower = ${getPower.join(', ')}`,
    givePower === undefined ? '' : `givepower = ${givePower.join(', ')}`,
    numHits === undefined ? '' : `numhits = ${numHits}`,
    groundCornerPush === undefined ? '' : `ground.cornerpush.veloff = ${groundCornerPush}`,
    airCornerPush === undefined ? '' : `air.cornerpush.veloff = ${airCornerPush}`,
    downCornerPush === undefined ? '' : `down.cornerpush.veloff = ${downCornerPush}`,
    guardCornerPush === undefined ? '' : `guard.cornerpush.veloff = ${guardCornerPush}`,
    airGuardCornerPush === undefined ? '' : `airguard.cornerpush.veloff = ${airGuardCornerPush}`,
    snap === undefined ? '' : `snap = ${snap.join(', ')}`,
    p1SprPriority === undefined ? '' : `p1sprpriority = ${p1SprPriority}`,
    p2SprPriority === undefined ? '' : `p2sprpriority = ${p2SprPriority}`,
  ].filter(Boolean).join('\n');
  const fallLines = [
    airAnimType === undefined ? '' : `air.animtype = ${airAnimType}`,
    fall === undefined ? '' : `fall = ${fall ? 1 : 0}`,
    fallVelocity ? `fall.velocity = ${fallVelocity.join(', ')}` : '',
    fallRecover === undefined ? '' : `fall.recover = ${fallRecover ? 1 : 0}`,
    fallRecoverTime === undefined ? '' : `fall.recovertime = ${fallRecoverTime}`,
    downVelocity ? `down.velocity = ${downVelocity.join(', ')}` : '',
    downHitTime === undefined ? '' : `down.hittime = ${downHitTime}`,
  ].filter(Boolean).join('\n');
  const guardLines = [
    guardFlag === undefined ? '' : `guardflag = ${guardFlag}`,
    guardVelocity ? `guard.velocity = ${guardVelocity.join(', ')}` : '',
    guardPauseTime ? `guard.pausetime = ${guardPauseTime.join(', ')}` : '',
    guardHitTime === undefined ? '' : `guard.hittime = ${guardHitTime}`,
    guardDistance === undefined ? '' : `guard.dist = ${guardDistance}`,
    guardDamage === undefined ? '' : `guard.damage = ${guardDamage}`,
    guardKill === undefined ? '' : `guard.kill = ${guardKill ? 1 : 0}`,
    guardControlTime === undefined ? '' : `guard.ctrltime = ${guardControlTime}`,
    p1StateNo === undefined ? '' : `p1stateno = ${p1StateNo}`,
    p2StateNo === undefined ? '' : `p2stateno = ${p2StateNo}`,
    p2GetP1State === undefined ? '' : `p2getp1state = ${p2GetP1State ? 1 : 0}`,
    forceStand === undefined ? '' : `forcestand = ${forceStand ? 1 : 0}`,
    sparkNo === undefined ? '' : `sparkno = ${sparkNo}`,
    guardSparkNo === undefined ? '' : `guard.sparkno = ${guardSparkNo}`,
    sparkXY === undefined ? '' : `sparkxy = ${sparkXY.join(', ')}`,
    hitSound === undefined ? '' : `hitsound = ${hitSound}`,
    guardSound === undefined ? '' : `guardsound = ${guardSound}`,
    envShake === undefined ? '' : `envshake.time = ${envShake[0]}\nenvshake.freq = ${envShake[1]}\nenvshake.ampl = ${envShake[2]}\nenvshake.phase = ${envShake[3]}`,
  ].filter(Boolean).join('\n');
  const cns = parseCnsText(`
[Data]
airjuggle = ${airJuggle ?? 15}
[Statedef 0]
type = ${targetStateType}
movetype = ${targetMoveType}
physics = ${targetStateType === 'A' ? 'A' : 'S'}
[Statedef 200]
type = S
movetype = A
physics = S
${juggle === undefined ? '' : `juggle = ${juggle}`}
[State 200, Hit]
type = HitDef
trigger1 = 1
${attr === undefined ? '' : `attr = ${attr}`}
${hitFlag === undefined ? '' : `hitflag = ${hitFlag}`}
damage = ${damage}, 0
${hitTimeLines}
${animTypeLine}
${velocityLines}
${pauseTimeLine}
${hitIdLine}
${hitOnceLine}
${auxiliaryLines}
${fallLines}
${guardLines}
`);
  const initial = createInitialGameState();
  const attackerIndex = attackerId - 1;
  const targetIndex = attackerId === 1 ? 1 : 0;
  const players = [...initial.players] as typeof initial.players;
  const resolvedFacing = attackerFacing ?? (attackerId === 1 ? 1 : -1);
  players[attackerIndex] = {
    ...players[attackerIndex],
    x: attackerX ?? (resolvedFacing === 1 ? 240 : 290),
    facing: resolvedFacing,
    stateNo: 200,
    animNo: 200,
    moveType: 'A',
    power: attackerPower,
  };
  players[targetIndex] = {
    ...players[targetIndex],
    x: targetX ?? (resolvedFacing === 1 ? 290 : 240),
    animNo: 0,
    life: targetLife ?? players[targetIndex].life,
    hitBy: targetHitBy,
    notHitBy: targetNotHitBy,
    stateType: targetStateType,
    physics: targetStateType === 'A' ? 'A' : targetStateType === 'C' ? 'C' : 'S',
    power: targetPower,
  };
  const runtime = stepCnsStateRuntime({ ...initial, players }, cns, attackerId === 1 ? { p2Commands: targetCommands } : { p1Commands: targetCommands }).state;
  return resolveFallbackHits(runtime, airDocument);
}

function resolveSimultaneousHits(p1Priority: [number, string], p2Priority: [number, string]) {
  const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S
[State 200, P1 Hit]
type = HitDef
trigger1 = 1
attr = S, NA
hitflag = MAF
damage = 37, 0
pausetime = 0, 0
priority = ${p1Priority[0]}, ${p1Priority[1]}
[Statedef 201]
type = S
movetype = A
physics = S
[State 201, P2 Hit]
type = HitDef
trigger1 = 1
attr = S, NA
hitflag = MAF
damage = 37, 0
pausetime = 0, 0
priority = ${p2Priority[0]}, ${p2Priority[1]}
`);
  const initial = createInitialGameState();
  const runtime = stepCnsStateRuntime({
    ...initial,
    players: [
      { ...initial.players[0], x: 240, stateNo: 200, animNo: 200, moveType: 'A' },
      { ...initial.players[1], x: 290, stateNo: 201, animNo: 200, moveType: 'A' },
    ],
  }, cns).state;
  return resolveFallbackHits(runtime, air);
}
