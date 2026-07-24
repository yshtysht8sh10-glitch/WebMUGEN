import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { applyFallbackStageRules } from '../engine/FallbackStageRules';
import { stepCnsPhysicsMotion } from './CnsPhysicsStep';
import { stepCnsStateRuntime } from './CnsStateRuntime';

function targetState(hitDefId = 42) {
  const state = createInitialGameState();
  return {
    ...state,
    players: [
      { ...state.players[0], stateNo: 200, x: 100, y: 20, facing: -1 as const, targets: [{ playerId: 2, hitDefId, activeHitDefId: 7 }] },
      { ...state.players[1], stateNo: 5000, vx: 0, vy: 0, life: 800, power: 100, x: 300, y: 0 },
    ] as typeof state.players,
  };
}

describe('CnsStateRuntime target controllers', () => {
  it('applies common target mutations to the registered target selected by HitDef id', () => {
    const cns = parseCnsText(`
[Statedef 200]
[State 200, VelSet]
type = TargetVelSet
trigger1 = 1
id = 42
x = 3
y = -2
[State 200, VelAdd]
type = TargetVelAdd
trigger1 = 1
id = 42
x = 1
y = .5
[State 200, Life]
type = TargetLifeAdd
trigger1 = 1
id = 42
value = -100
[State 200, Power]
type = TargetPowerAdd
trigger1 = 1
id = 42
value = 50
[State 200, Facing]
type = TargetFacing
trigger1 = 1
id = 42
value = -1
[State 200, Bind]
type = TargetBind
trigger1 = 1
id = 42
time = 5
pos = 10, -20
[State 200, State]
type = TargetState
trigger1 = 1
id = 42
value = 6000
[Statedef 6000]
type = A
movetype = H
physics = N
ctrl = 0
`);

    const result = stepCnsStateRuntime(targetState(), cns);
    expect(result.state.players[1]).toMatchObject({
      stateNo: 6000, stateType: 'A', moveType: 'H', physics: 'N', ctrl: false,
      vx: 0, vy: 0, life: 700, power: 150, facing: 1, x: 90, y: 0,
      targetBind: { ownerId: 1, remaining: 5, offsetX: 10, offsetY: -20 },
    });
    expect(result.state.players[0].hitDiagnosticLines?.join('\n')).toContain('raw.target_controller owner=p1 controller=TargetState');
  });

  it('safely does nothing and logs a diagnostic when id does not match', () => {
    const cns = parseCnsText(`
[Statedef 200]
[State 200, Missing]
type = TargetLifeAdd
trigger1 = 1
id = 99
value = -100
`);
    const result = stepCnsStateRuntime(targetState(), cns);
    expect(result.state.players[1].life).toBe(800);
    expect(result.state.players[0].hitDiagnosticLines?.join('\n')).toContain('result=noop reason=target_not_found');
  });

  it('maintains a finite TargetBind after both players move and then releases it', () => {
    const cns = parseCnsText(`
[Statedef 200]
physics = N
[State 200, Bind]
type = TargetBind
trigger1 = Time = 0
time = 2
pos = 10, -20
`);
    const initial = targetState();
    initial.players[0] = { ...initial.players[0], physics: 'N', vx: 12, playerPush: false };
    initial.players[1] = { ...initial.players[1], physics: 'N', vy: 3, playerPush: false };

    const activatedState = stepCnsStateRuntime(initial, cns).state;
    const activated = {
      ...activatedState,
      players: activatedState.players.map((player) => ({ ...player, playerPush: false })) as typeof activatedState.players,
    };
    expect(activated.players[1]).toMatchObject({ vx: 12, vy: 0 });
    const first = applyFallbackStageRules(stepCnsPhysicsMotion(activated, cns));
    expect(first.players[0]).toMatchObject({ x: 112, y: 20 });
    expect(first.players[1]).toMatchObject({ x: 102, y: 0, vx: 12, vy: 0, targetBind: { remaining: 1 } });

    const second = applyFallbackStageRules(stepCnsPhysicsMotion(first, cns));
    expect(second.players[0].x).toBe(124);
    expect(second.players[1]).toMatchObject({ x: 114, y: 0, vx: 12, vy: 0 });
    expect(second.players[1].targetBind).toBeUndefined();

    const released = stepCnsPhysicsMotion(second, cns);
    expect(released.players[1]).toMatchObject({ x: 126, y: 0, vx: 12, vy: 0 });
  });

  it('uses the default one-tick duration and leaves a stationary target stopped on release', () => {
    const cns = parseCnsText(`
[Statedef 200]
physics = N
[State 200, Bind]
type = TargetBind
trigger1 = Time = 0
`);
    const initial = targetState();
    initial.players[0] = { ...initial.players[0], physics: 'N', vx: 0, vy: 0, playerPush: false };
    initial.players[1] = { ...initial.players[1], physics: 'N', vx: 9, vy: -4, playerPush: false };

    const activatedState = stepCnsStateRuntime(initial, cns).state;
    const activated = {
      ...activatedState,
      players: activatedState.players.map((player) => ({ ...player, playerPush: false })) as typeof activatedState.players,
    };
    expect(activated.players[1]).toMatchObject({ x: 100, y: 20, vx: 0, vy: 0, targetBind: { remaining: 1 } });
    const bound = applyFallbackStageRules(stepCnsPhysicsMotion(activated, cns));
    expect(bound.players[1]).toMatchObject({ x: 100, y: 20, vx: 0, vy: 0 });
    expect(bound.players[1].targetBind).toBeUndefined();
    expect(stepCnsPhysicsMotion(bound, cns).players[1]).toMatchObject({ x: 100, y: 20, vx: 0, vy: 0 });
  });

  it('treats time zero as cancellation and normalizes any negative time to indefinite', () => {
    const cancel = parseCnsText(`
[Statedef 200]
[State 200, Cancel]
type = TargetBind
trigger1 = 1
time = 0
pos = 99, 99
`);
    const initial = targetState();
    initial.players[1] = {
      ...initial.players[1],
      targetBind: { ownerId: 1, remaining: 3, offsetX: 1, offsetY: 2 },
    };
    const cancelled = stepCnsStateRuntime(initial, cancel).state.players[1];
    expect(cancelled).toMatchObject({ x: 300, y: 0 });
    expect(cancelled.targetBind).toBeUndefined();

    const indefinite = parseCnsText(`
[Statedef 200]
[State 200, Forever]
type = TargetBind
trigger1 = 1
time = -2
`);
    expect(stepCnsStateRuntime(targetState(), indefinite).state.players[1].targetBind?.remaining).toBe(-1);
  });

  it('keeps an indefinite TargetBind relative to the owner current facing', () => {
    const state = targetState();
    state.players[0] = { ...state.players[0], x: 120, facing: 1, physics: 'N' };
    state.players[1] = {
      ...state.players[1],
      physics: 'N',
      targetBind: { ownerId: 1, remaining: -1, offsetX: 15, offsetY: -30 },
    };

    const next = stepCnsPhysicsMotion(state);
    expect(next.players[1]).toMatchObject({ x: 135, y: -10, vx: 0, vy: 0, targetBind: { remaining: -1 } });
  });

  it('keeps the target attached without consuming finite bind time during participant HitPause', () => {
    const state = targetState();
    state.players[0] = { ...state.players[0], x: 100, vx: 8, physics: 'N', facing: 1 };
    state.players[1] = {
      ...state.players[1],
      physics: 'N',
      hitPause: 1,
      targetBind: { ownerId: 1, remaining: 2, offsetX: 20, offsetY: -10 },
    };

    const next = stepCnsPhysicsMotion(state);
    expect(next.players[1]).toMatchObject({ x: 128, y: 10, vx: 8, vy: 0, hitPause: 0, targetBind: { remaining: 2 } });
  });

  it('safely does nothing when the owner has no registered target', () => {
    const cns = parseCnsText(`
[Statedef 200]
[State 200, NoTarget]
type = TargetVelSet
trigger1 = 1
x = 9
`);
    const state = targetState();
    state.players[0].targets = [];
    const result = stepCnsStateRuntime(state, cns);
    expect(result.state.players[1].vx).toBe(0);
    expect(result.state.players[0].hitDiagnosticLines?.join('\n')).toContain('targets=none result=noop reason=target_not_found');
  });

  it('prevents later target controllers from mutating a target after TargetDrop', () => {
    const cns = parseCnsText(`
[Statedef 200]
[State 200, Drop]
type = TargetDrop
trigger1 = 1
id = 42
[State 200, TooLate]
type = TargetLifeAdd
trigger1 = 1
id = 42
value = -100
`);
    const state = targetState();
    state.players[1].targetBind = { ownerId: 1, remaining: 5, offsetX: 0, offsetY: 0 };
    const result = stepCnsStateRuntime(state, cns);
    expect(result.state.players[0].targets).toEqual([]);
    expect(result.state.players[1].life).toBe(800);
    expect(result.state.players[1].targetBind).toBeUndefined();
    expect(result.state.players[0].hitDiagnosticLines?.join('\n')).toContain('controller=TargetDrop');
  });
});
