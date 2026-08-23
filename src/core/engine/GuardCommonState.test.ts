import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseAirText } from '../../parser/air/AirParser';
import { mergeCnsDocuments, mergeMissingCnsStates } from '../character/CharacterLoader';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { advanceExternalCnsStateEntryFrame, enterCnsStateAndRunTimeZero, stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { applyExplodControllerEvents, type ExplodControllerEvent } from '../explod/ExplodSystem';
import { spawnHelper } from '../helper/HelperSystem';
import { applyFallbackHitRecovery } from './FallbackHitRecovery';
import { resolveFallbackHits } from './FallbackHitResolver';
import { createInitialGameState } from './GameState';
import type { ActiveHitDef, GameState } from './types';

const common = parseCnsText(readFileSync('public/chars/common1.cns', 'utf8'));
const commonControl = parseCnsText(readFileSync('public/chars/common.cmd', 'utf8'));
const itokoAir = parseAirText(readFileSync('public/chars/itoko/itoko.air', 'utf8'));
const itokoWithCommon = mergeMissingCnsStates(
  mergeMissingCnsStates(
    mergeCnsDocuments(
      parseCnsText(readFileSync('public/chars/itoko/itoko.cns', 'utf8')),
      parseCnsText(readFileSync('public/chars/itoko/itoko.cmd', 'utf8')),
    ),
    common,
  ),
  commonControl,
);
const guardCollisionAir = parseAirText(`
[Begin Action 130]
Clsn2: 1
  Clsn2[0] = -20,-80,20,0
0,0,0,0,-1
[Begin Action 200]
Clsn1: 1
  Clsn1[0] = -20,-80,20,0
0,0,0,0,-1
`);

describe('guard common-state integration', () => {
  it('advances itoko guard-break var(25) once and creates the Helper 2030 gauge Explods', () => {
    const initial = createInitialGameState();
    const activeHitDef: ActiveHitDef = {
      diagnosticId: 131,
      damage: 20,
      guardDamage: 0,
      damageValues: [20, 0],
      damageSource: 'cns',
      attr: { stateType: 'S', attackTypes: ['NA'] },
      guardFlag: 'M',
      animType: 'Light',
      pauseTime: { attacker: 0, defender: 4 },
      guardPauseTime: { attacker: 0, defender: 4 },
      groundHitTime: 12,
      guardHitTime: 12,
      groundVelocity: { x: -4, y: 0 },
      guardVelocity: { x: -4, y: 0 },
      airVelocity: { x: -2, y: -4 },
    };
    let state: GameState = {
      ...initial,
      players: [{
        ...initial.players[0], x: 300, stateNo: 130, stateType: 'S', animNo: 130,
        guardIntent: true, vars: { 1: 0, 25: 0 },
      }, {
        ...initial.players[1], x: 300, facing: -1, stateNo: 200, stateType: 'S',
        moveType: 'A', animNo: 200, activeHitDef,
      }],
    };

    state = resolveFallbackHits(
      state,
      guardCollisionAir,
      true,
      undefined,
      (player, opponent, stateNo) => advanceExternalCnsStateEntryFrame(enterCnsStateAndRunTimeZero(
        player,
        opponent,
        stateNo,
        itokoWithCommon,
        { getAnimationDuration: (animNo) => getMugenAnimEndTime(itokoAir, animNo) },
      )),
    );
    expect(state.players[0]).toMatchObject({ stateNo: 150, stateTime: 1, animNo: 150, animTime: 1, hitPause: 4 });

    state = stepCnsStateRuntime(state, itokoWithCommon, { p1Commands: new Set(['holdback']) }).state;
    expect(state.players[0].vars?.[25]).toBe(3);
    expect(state.helpers.entries.filter((entry) => entry.helperId === 2030)).toHaveLength(0);

    state = { ...stepCnsPhysicsMotion(state, itokoWithCommon), frame: state.frame + 2 };
    state = stepCnsStateRuntime(state, itokoWithCommon, { p1Commands: new Set(['holdback']) }).state;
    expect(state.players[0].vars?.[25]).toBe(3);
    const gaugeHelper = state.helpers.entries.find((entry) => entry.helperId === 2030);
    expect(gaugeHelper).toMatchObject({ helperId: 2030, rootEntityId: 1, parentEntityId: 1 });

    state = { ...stepCnsPhysicsMotion(state, itokoWithCommon), frame: state.frame + 2 };
    const explodEvents: ExplodControllerEvent[] = [];
    const helperPass = stepCnsStateRuntime(state, itokoWithCommon, {
      p1Commands: new Set(['holdback']),
      onExplodCreate: (event) => explodEvents.push(event),
      onExplodModify: (event) => explodEvents.push(event),
      onExplodRemove: (event) => explodEvents.push(event),
      onExplodBindTime: (event) => explodEvents.push(event),
    });
    state = applyExplodControllerEvents(helperPass.state, explodEvents);

    const gaugeExplods = state.explods.entries.filter((entry) => entry.owner.entityId === gaugeHelper?.entityId);
    expect(gaugeExplods.map((entry) => entry.mugenId)).toEqual([2030, 2031, 2032]);
    expect(gaugeExplods.find((entry) => entry.mugenId === 2031)?.render.scaleX).toBeCloseTo(0.485);
  });

  it('places itoko P2 guard-break Explods in screen space for the WinMUGEN light postype alias', () => {
    const initial = createInitialGameState();
    const p2 = { ...initial.players[1], vars: { 25: 3 } };
    const helpers = spawnHelper(initial.helpers, {
      helperId: 2030,
      rootEntityId: 2,
      parentEntityId: 2,
      ownerCharacterId: 2,
      stateOwnerId: 2,
      animationOwnerId: 2,
      stateNo: 2030,
      x: 300,
      y: p2.y,
      facing: -1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: p2,
    }, itokoWithCommon);
    const explodEvents: ExplodControllerEvent[] = [];

    stepCnsStateRuntime({ ...initial, players: [initial.players[0], p2], helpers }, itokoWithCommon, {
      screenWidth: 320,
      onExplodCreate: (event) => explodEvents.push(event),
    });

    const p2Gauge = explodEvents.filter((event) => event.type === 'create');
    expect(p2Gauge.map((event) => event.request.mugenId)).toEqual([2030, 2031, 2032]);
    expect(p2Gauge.map((event) => ({ postype: event.request.postype, x: event.request.position.x }))).toEqual([
      { postype: 'left', x: 238 },
      { postype: 'left', x: 232 },
      { postype: 'left', x: 238 },
    ]);
  });

  it('allows itoko automatic State -2 guard-break routing before its hit-pause VarSet clears var(25)', () => {
    const initial = createInitialGameState();
    const guarded = {
      ...initial.players[0],
      stateNo: 150,
      stateTime: 1,
      stateHeaderAppliedStateNo: 150,
      animNo: 150,
      moveType: 'H' as const,
      ctrl: false,
      hitPause: 3,
      vars: { 1: 0, 25: 97 },
      getHitVars: { guarded: 1, animtype: 0 },
      hitStun: {
        activeHitDefId: 131,
        selectedHitTime: 12,
        kind: 'ground' as const,
        source: 'active_hitdef' as const,
        targetStateTypeAtHit: 'S' as const,
        elapsed: 1,
        lastStateNo: 150,
      },
    };

    const thresholdPass = stepCnsStateRuntime({ ...initial, players: [guarded, initial.players[1]] }, itokoWithCommon);
    expect(thresholdPass.state.players[0]).toMatchObject({ stateNo: 150, hitPause: 3, vars: expect.objectContaining({ 25: 100 }) });

    const result = stepCnsStateRuntime(stepCnsPhysicsMotion(thresholdPass.state, itokoWithCommon), itokoWithCommon);

    expect(result.traces[0].executedControllers).toContain('ChangeState');
    expect(result.state.players[0]).toMatchObject({ prevStateNo: 150, stateNo: 2031, animNo: 2035, ctrl: false, vars: expect.objectContaining({ 25: 99 }) });
    expect(result.state.players[0].hitDiagnosticLines?.join('\n')).not.toContain('input_changestate_during_hitstun');
  });

  it('uses unmodified standing GuardHit states and returns to standing guard', () => {
    const initial = createInitialGameState();
    let state: GameState = {
      ...initial,
      players: [{ ...initial.players[0], x: 370 }, {
        ...initial.players[1], stateNo: 150, animNo: 150, moveType: 'H', physics: 'N', ctrl: false,
        vx: -2, hitVelX: -2, getHitVars: { guarded: 1, slidetime: 0, ctrltime: 2 },
        hitStun: {
          activeHitDefId: 5, selectedHitTime: 5, kind: 'ground', source: 'active_hitdef',
          targetStateTypeAtHit: 'S', elapsed: 0, lastStateNo: 150, selectedAnim: 150,
        },
      }],
    };

    const visited: number[] = [];
    const recoilControl: boolean[] = [];
    for (let frame = 0; frame < 10 && state.players[1].stateNo !== 130; frame += 1) {
      const cns = stepCnsStateRuntime(state, common, { p2Commands: new Set(['holdback']) });
      visited.push(cns.state.players[1].stateNo);
      if (cns.state.players[1].stateNo === 151) recoilControl.push(cns.state.players[1].ctrl);
      state = applyFallbackHitRecovery(stepCnsPhysicsMotion(cns.state, common));
    }

    expect(visited).toContain(151);
    expect(recoilControl[0]).toBe(false);
    expect(recoilControl).toContain(true);
    expect(state.players[1]).toMatchObject({ stateNo: 130, stateType: 'S' });
    expect(state.players[1].hitStun).toBeUndefined();

    const released = stepCnsStateRuntime(state, common).state;
    expect(released.players[1]).toMatchObject({ stateNo: 140, stateType: 'S' });
  });

  it.each([
    { stateType: 'S' as const, physics: 'S' as const, animNo: 145, destination: 0 },
    { stateType: 'C' as const, physics: 'C' as const, animNo: 146, destination: 11 },
    { stateType: 'A' as const, physics: 'A' as const, animNo: 142, destination: 51 },
  ])('leaves itoko guard end for StateType $stateType when its finite animation ends', ({ stateType, physics, animNo, destination }) => {
    const initial = createInitialGameState();
    const animationEndTime = getMugenAnimEndTime(itokoAir, animNo);
    expect(animationEndTime).not.toBeNull();

    const state: GameState = {
      ...initial,
      players: [{
        ...initial.players[0],
        stateNo: 140,
        stateTime: animationEndTime!,
        stateType,
        physics,
        ctrl: true,
        animNo,
        animTime: animationEndTime!,
        vars: { 1: 1 },
        y: stateType === 'A' ? initial.players[0].y - 20 : initial.players[0].y,
        vy: stateType === 'A' ? -1 : 0,
      }, initial.players[1]],
    };

    const result = stepCnsStateRuntime(state, itokoWithCommon, {
      p1Commands: stateType === 'C' ? new Set(['holddown']) : new Set(),
      getAnimationDuration: (actionNo) => getMugenAnimEndTime(itokoAir, actionNo),
    });

    expect(result.state.players[0]).toMatchObject({
      prevStateNo: 140,
      stateNo: destination,
      stateTime: 0,
      vars: expect.objectContaining({ 1: 0 }),
    });
    expect(result.traces[0]).toMatchObject({ stateNo: 140, afterStateNo: destination, mugenAnimTime: 0 });
  });

  it('clears itoko strong-guard mode after State 201 before the next y attack', () => {
    const initial = createInitialGameState();
    const attackEndTime = getMugenAnimEndTime(itokoAir, 201);
    expect(attackEndTime).not.toBeNull();

    let state: GameState = {
      ...initial,
      players: [{
        ...initial.players[0],
        stateNo: 201,
        stateTime: attackEndTime!,
        stateType: 'S',
        moveType: 'A',
        physics: 'S',
        ctrl: false,
        animNo: 201,
        animTime: attackEndTime!,
      }, initial.players[1]],
    };
    const input = {
      getAnimationDuration: (actionNo: number) => getMugenAnimEndTime(itokoAir, actionNo),
    };

    state = stepCnsStateRuntime(state, itokoWithCommon, {
      ...input,
      p1Commands: new Set(['hold_z']),
    }).state;
    expect(state.players[0]).toMatchObject({ stateNo: 130, vars: expect.objectContaining({ 1: 1 }) });

    state = stepCnsStateRuntime(state, itokoWithCommon, input).state;
    expect(state.players[0]).toMatchObject({ stateNo: 140, vars: expect.objectContaining({ 1: 0 }) });

    state = stepCnsStateRuntime(state, itokoWithCommon, input).state;
    expect(state.players[0].vars?.[1]).toBe(0);

    state = stepCnsStateRuntime(state, itokoWithCommon, {
      ...input,
      p1Commands: new Set(['y']),
    }).state;
    expect(state.players[0].stateNo).toBe(200);
  });
});
