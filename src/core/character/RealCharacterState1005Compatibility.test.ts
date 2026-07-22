import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import type { PlayerState, ProjectileState } from '../engine/types';

const source = readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-Awaza.cns', 'utf8');
const parsed = parseCnsText(source);
const state1005 = parsed.states.find((state) => state.stateNo === 1005)!;
const document = { metadataSections: parsed.metadataSections, states: [state1005] };

describe('T-H-M-A State 1005 compatibility', () => {
  it('retains every controller, trigger, and Projectile PalFX parameter from the real CNS', () => {
    expect(state1005.controllers.map((controller) => controller.type)).toEqual([
      'VarAdd', 'PlaySnd', 'Projectile', 'Explod', 'Explod', 'PlaySnd', 'PlaySnd',
      'VarSet', 'VarSet', 'VarSet', 'ChangeState', 'ChangeAnim', 'PowerAdd',
    ]);
    expect(state1005.controllers.flatMap((controller) => controller.triggers.map((trigger) => trigger.expression))).toEqual([
      'Time = 0', 'fvar(12) < 10', 'AnimElem = 8', 'Random = [0,499]', 'AnimElem = 9',
      'AnimElem = 8', 'time = 0', 'AnimElem = 8', 'Time = 0', 'MoveGuarded = 1',
      'MoveGuarded = 1', 'MoveGuarded = 1', 'AnimTime = 0', 'var(19) = 1', 'Time = 0',
      'var(20) = 1', 'MoveHit = 1',
    ]);
    const projectile = state1005.controllers.find((controller) => controller.type === 'Projectile')!;
    expect(projectile.params).toMatchObject({
      'palfx.time': 50,
      'palfx.add': [0, -70, -170],
      'palfx.sinadd': [60, 60, 50, 10],
      'palfx.color': 0,
      'palfx.invertall': 1,
    });
  });

  it('executes the Time/AnimElem/Random, Var, sound, Explod and Projectile routes', () => {
    const initial = createInitialGameState();
    const sounds: unknown[] = [];
    const explods: unknown[] = [];
    const projectiles: ProjectileState[] = [];
    const player = {
      ...initial.players[0], stateNo: 1005, animNo: 1005,
      fvars: { 12: 9 }, vars: { 19: 0, 20: 0 },
    } as PlayerState;
    const element8 = stepCnsStateRuntime({ ...initial, players: [player, initial.players[1]] }, document, {
      random: 499,
      getAnimationTriggerInfo: () => ({ elementNo: 8, elementTime: 0, elementStarted: true, elementCount: 9, elementTimes: [0, 1, 2, 3, 4, 5, 6, 7, 8] }),
      onSoundPlay: (event) => sounds.push(event),
      onExplodCreate: (event) => explods.push(event),
    }).state.players[0] as PlayerState & { fvars: Record<number, number> };
    expect(element8.fvars[12]).toBe(10);
    expect(sounds).toHaveLength(3);
    expect(explods).toHaveLength(2);

    stepCnsStateRuntime({ ...initial, players: [{ ...player, stateTime: 8 }, initial.players[1]] }, document, {
      getAnimationTriggerInfo: () => ({ elementNo: 9, elementTime: 0, elementStarted: true, elementCount: 9, elementTimes: [0, 1, 2, 3, 4, 5, 6, 7, 8] }),
      getAnimationDuration: (animNo) => animNo === 15210 ? 6 : 20,
      onProjectileCreate: (projectile) => projectiles.push(projectile),
    });
    expect(projectiles).toHaveLength(1);
    expect(projectiles[0]).toMatchObject({ id: 1005, animNo: 15201, hitAnimNo: 15210, scaleX: 0.5, scaleY: 0.5 });
    expect(projectiles[0].hitDef.palFx).toEqual({
      duration: 50, color: 0, invertAll: true,
      add: { red: 0, green: -70, blue: -170 },
      multiply: { red: 256, green: 256, blue: 256 },
      sinAdd: { red: 60, green: 60, blue: 50, period: 10 },
    });
    expect(projectiles[0].hitDef.guardSparkOffset).toEqual({ x: 20, y: -67 });
  });

  it('executes MoveGuarded, MoveHit, ChangeAnim and AnimTime branches', () => {
    const initial = createInitialGameState();
    const guarded = stepCnsStateRuntime({
      ...initial,
      players: [{
        ...initial.players[0], stateNo: 1005, stateTime: 1, animNo: 1005,
        moveContact: { activeHitDefId: 1005, contact: true, hit: false, guarded: true, elapsed: 1, hitCount: 0 },
      }, initial.players[1]],
    }, document, { getAnimationDuration: () => 20 }).state.players[0] as PlayerState & { fvars: Record<number, number> };
    expect(guarded.fvars).toMatchObject({ 1: 1, 2: 0, 3: 1 });

    const hit = stepCnsStateRuntime({
      ...initial,
      players: [{
        ...initial.players[0], stateNo: 1005, stateTime: 1, animNo: 1005, power: 1000,
        vars: { 20: 1 },
        moveContact: { activeHitDefId: 1005, contact: true, hit: true, guarded: false, elapsed: 1, hitCount: 1 },
      } as PlayerState, initial.players[1]],
    }, document, { getAnimationDuration: () => 20 }).state.players[0];
    expect(hit.power).toBe(710);

    const changedAnim = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 1005, animNo: 1005, vars: { 19: 1 } } as PlayerState, initial.players[1]],
    }, document, { getAnimationDuration: () => 20 }).state.players[0];
    expect(changedAnim.animNo).toBe(1006);

    const changedState = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 1005, stateTime: 20, animNo: 1005, animTime: 20 } as PlayerState, initial.players[1]],
    }, document, { getAnimationDuration: () => 20 }).state.players[0];
    expect(changedState.stateNo).toBe(0);
  });
});
