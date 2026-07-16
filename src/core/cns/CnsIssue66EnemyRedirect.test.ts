import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { getAnimationTriggerInfo } from '../animation/AnimationPlayer';
import { createInitialGameState } from '../engine/GameState';
import { restartRound } from '../engine/RoundRestart';
import { stepCnsPhysicsMotion } from './CnsPhysicsStep';
import { evaluateCnsRuntimeTrigger, inspectCnsRuntimeRedirect } from './CnsRuntimeTrigger';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('Issue #66 enemy redirect and 3405/3415 lifecycle', () => {
  it('retains redirect syntax in every repeated trigger record', () => {
    const cns = parseCnsText(`
[Statedef 3405]
[State 3405, route]
type = ChangeState
trigger1 = AnimTime = 0
trigger1 = enemy, GetHitVar(hitcount) >= 0
trigger1 = enemynear(0), GetHitVar(hitcount) <= 17
value = 3415
`);
    expect(cns.states[0].controllers[0].triggers.map((trigger) => trigger.expression)).toEqual([
      'AnimTime = 0',
      'enemy, GetHitVar(hitcount) >= 0',
      'enemynear(0), GetHitVar(hitcount) <= 17',
    ]);
  });

  it.each([1, 2] as const)('resolves P%i enemy/enemynear index zero to the other root player', (ownerId) => {
    const state = createInitialGameState();
    const player = state.players[ownerId - 1];
    const opponent = state.players[ownerId === 1 ? 1 : 0];
    const context = { player, opponent };
    expect(evaluateCnsRuntimeTrigger(`enemy, StateNo = ${opponent.stateNo}`, context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger(`enemynear(0), Ctrl = ${opponent.ctrl ? 1 : 0}`, context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemy(0), Alive', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemy(1), Alive', context)).toBe(false);
    expect(evaluateCnsRuntimeTrigger('enemynear(1), Alive', context)).toBe(false);
  });

  it('evaluates MoveType, StateNo, position, velocity, Ctrl, Alive and GetHitVar on the redirected entity', () => {
    const state = createInitialGameState();
    const self = { ...state.players[0], x: 10, y: 20, vx: 1, vy: 2, moveType: 'I' as const, ctrl: true };
    const enemy = {
      ...state.players[1], x: 300, y: 240, vx: -3, vy: -4, stateNo: 5000, moveType: 'H' as const, ctrl: false,
      getHitVars: { hitcount: 7 },
    };
    const context = { player: self, opponent: enemy };
    expect(evaluateCnsRuntimeTrigger('enemy, MoveType = H', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemy, StateNo = 5000', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemy, Pos X = 300', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemy, Pos Y = -45', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemynear, Vel X = 3', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemynear, Vel Y = -4', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemy, Ctrl = 0', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemy, Alive', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemy, GetHitVar(hitcount) = 7', context)).toBe(true);
  });

  it('uses redirected animation context and returns SFalse without an enemy instead of self fallback', () => {
    const state = createInitialGameState();
    const self = { ...state.players[0], animNo: 100, animTime: 9 };
    const enemy = { ...state.players[1], animNo: 200, animTime: 3 };
    const context = {
      player: self,
      opponent: enemy,
      animTime: -1,
      animElemNo: 9,
      getRedirectAnimationContext: () => ({
        animTime: -7, animElemNo: 2, animElemTime: 0, animElemStarted: true, animElemCount: 3, animElemTimes: [-3, 0, -4],
      }),
    };
    expect(evaluateCnsRuntimeTrigger('enemy, Anim = 200', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemy, AnimTime = -7', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemy, AnimElem = 2', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('enemy, MoveType != H', { player: self })).toBe(false);
    expect(evaluateCnsRuntimeTrigger('enemy, Alive', { player: self })).toBe(false);
    const missing = inspectCnsRuntimeRedirect('enemy, StateNo = 0', { player: self });
    expect(missing).toMatchObject({ value: null, result: false });
    expect(missing?.resolvedEntityId).toBeUndefined();
  });

  it('keeps same-group enemy conditions as AND and numbered groups as OR', () => {
    const cns = parseCnsText(`
[Statedef 1]
[State 1, route]
type = ChangeState
triggerall = Alive
trigger1 = enemy, StateNo = 5000
trigger1 = enemy, MoveType = H
trigger2 = enemynear, Ctrl = 1
value = 2
[Statedef 2]
`);
    const state = createInitialGameState();
    state.players = [{ ...state.players[0], stateNo: 1 }, { ...state.players[1], stateNo: 5000, moveType: 'I', ctrl: false }];
    const failed = stepCnsStateRuntime(state, cns).state;
    expect(failed.players[0].stateNo).toBe(1);
    expect(failed.players[0].hitDiagnosticLines?.join('\n')).toContain('parser=recognized evaluator=redirect redirect=enemy resolvedEntity=p2 value=5000 result=1 selfFallback=0');
    expect(failed.players[0].hitDiagnosticLines?.join('\n')).toContain('groupAggregate=0 ChangeStateValue=2 ChangeStateExecuted=0');
    state.players[1] = { ...state.players[1], moveType: 'H' };
    expect(stepCnsStateRuntime(state, cns).state.players[0].stateNo).toBe(2);
    state.players[1] = { ...state.players[1], stateNo: 0, moveType: 'I', ctrl: true };
    expect(stepCnsStateRuntime(state, cns).state.players[0].stateNo).toBe(2);
  });

  it('extracts only the bundled 3405/3415 ChangeState destinations and trigger groups', async () => {
    const source = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns', 'utf8');
    const cns = parseCnsText(source);
    const changeStates = (stateNo: number) => cns.states.find((state) => state.stateNo === stateNo)?.controllers
      .filter((controller) => controller.type.toLowerCase() === 'changestate') ?? [];

    expect(changeStates(3405).map((controller) => ({ value: controller.params.value, triggers: controller.triggers.map((trigger) => `${trigger.name}:${trigger.expression}`) }))).toEqual([
      { value: 3415, triggers: ['trigger1:AnimTime = 0', 'trigger1:enemy,GethitVar(hitcount) >= 0', 'trigger1:enemy,GethitVar(hitcount) <= 17'] },
      { value: 3415, triggers: ['trigger1:Time = 1', 'trigger1:enemy,GethitVar(hitcount) >= 18'] },
    ]);
    expect(changeStates(3415).map((controller) => ({ value: controller.params.value, triggers: controller.triggers.map((trigger) => `${trigger.name}:${trigger.expression}`) }))).toEqual([
      { value: 102, triggers: ['trigger1:statetype = S', 'trigger1:Time = 10'] },
      { value: 6140, triggers: ['trigger1:statetype = A', 'trigger1:Time = 10'] },
    ]);
  });

  it.each([1, 2] as const)('runs bundled T-H-M-A 3405 -> 3415 for P%i, holds the HitDef, and exits only at Time=10', async (ownerId) => {
    const [cnsSource, airSource] = await Promise.all([
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns', 'utf8'),
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air', 'utf8'),
    ]);
    const cns = parseCnsText(cnsSource);
    const air = parseAirText(airSource);
    const ownerIndex = ownerId - 1;
    const opponentIndex = ownerId === 1 ? 1 : 0;
    let state = createInitialGameState();
    state.players[ownerIndex] = { ...state.players[ownerIndex], stateNo: 3405, animNo: 3405, stateTime: 0, animTime: 0, ctrl: false };
    state.players[opponentIndex] = { ...state.players[opponentIndex], getHitVars: { hitcount: 0 } };
    const input = {
      getAnimationDuration: (animNo: number) => getMugenAnimEndTime(air, animNo),
      getAnimationTriggerInfo: (animNo: number, animTime: number) => getAnimationTriggerInfo(air, animNo, animTime),
    };
    const seen: number[] = [];
    let hitDefSeen = false;
    const hitDefAvailableDuring3415: boolean[] = [];
    for (let frame = 0; frame < 16; frame += 1) {
      state = stepCnsStateRuntime(state, cns, input).state;
      seen.push(state.players[ownerIndex].stateNo);
      if (state.players[ownerIndex].stateNo === 3415) {
        hitDefAvailableDuring3415.push(Boolean(state.players[ownerIndex].activeHitDef));
        if (state.players[ownerIndex].activeHitDef) hitDefSeen = true;
      }
      state = stepCnsPhysicsMotion(state, cns);
    }

    expect(seen).toContain(3415);
    expect(seen.slice(seen.indexOf(3415))).not.toContain(3405);
    expect(hitDefSeen).toBe(true);
    expect(hitDefAvailableDuring3415.every(Boolean)).toBe(true);
    expect(seen.slice(seen.indexOf(3415), seen.indexOf(3415) + 10)).toEqual(new Array(10).fill(3415));
    expect(seen).toContain(102);
    expect(restartRound(1).gameState.players[ownerIndex]).toMatchObject({ stateNo: 0, activeHitDef: null });
  });
});
