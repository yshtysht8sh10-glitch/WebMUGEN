import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { restartRound } from '../engine/RoundRestart';
import { spawnHelper } from '../helper/HelperSystem';
import { createInitialPauseState, startPause } from '../pause/PauseSystem';
import { stepCnsPhysicsMotion } from './CnsPhysicsStep';
import { stepCnsStateRuntime } from './CnsStateRuntime';
import { evaluateCnsRuntimeTrigger } from './CnsRuntimeTrigger';

describe('CNS Helper Phase 1 runtime', () => {
  const cns = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[State 0, Spawn]
type = Helper
trigger1 = time = 0
trigger1 = NumHelper(100) = 0
id = 100
pos = 10, -20
postype = p1
facing = -1
stateno = 100
size.xscale = 0.5
size.yscale = 0.75
pausemovetime = 12
supermovetime = 34

[StateDef 100]
type = A
movetype = I
physics = N
anim = 1000
ctrl = 0

[State 100, Nested]
type = Helper
trigger1 = time = 0
trigger1 = NumHelper(200) = 0
id = 200
stateno = 200

[State 100, Anim]
type = ChangeAnim
trigger1 = time = 0
value = 1001

[State 100, Destroy]
type = DestroySelf
trigger1 = time = 1

[StateDef 200]
type = S
movetype = I
physics = N
anim = 2000
ctrl = 0
`);

  it('spawns P1/P2 helpers after controller evaluation with separate runtime and MUGEN IDs', () => {
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime(initial, cns);

    expect(result.state.helpers.entries).toHaveLength(2);
    expect(result.state.helpers.entries.map((helper) => helper.entityId)).toEqual([3, 4]);
    expect(result.state.helpers.entries.map((helper) => helper.helperId)).toEqual([100, 100]);
    expect(result.state.helpers.entries[0]).toMatchObject({
      rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1,
      pauseMoveTime: 12, superMoveTime: 34,
    });
    expect(result.state.helpers.entries[1]).toMatchObject({
      rootEntityId: 2, parentEntityId: 2, ownerCharacterId: 2,
    });
    expect(result.state.helpers.entries[0].player).toMatchObject({
      stateNo: 100, stateTime: 0, animNo: 1000, animTime: 0,
      collisionWidth: { xScale: 0.5, yScale: 0.75 },
    });
    expect(result.traces).toHaveLength(2);
    expect(result.state.hitDiagnosticLines?.join('\n')).toContain('firstStep=next_frame');
  });

  it('runs Helper State/Anim on the next frame, supports nested parent identity, NumHelper, and DestroySelf', () => {
    let state = stepCnsStateRuntime(createInitialGameState(), cns).state;
    state = stepCnsPhysicsMotion(state, cns);
    expect(state.helpers.entries[0].player.stateTime).toBe(0);

    const stepped = stepCnsStateRuntime(state, cns);
    expect(stepped.state.helpers.entries).toHaveLength(4);
    expect(stepped.state.helpers.entries.slice(0, 2).map((helper) => helper.player.animNo)).toEqual([1001, 1001]);
    expect(stepped.state.helpers.entries.slice(2).map((helper) => helper.helperId)).toEqual([200, 200]);
    expect(stepped.state.helpers.entries[2]).toMatchObject({ rootEntityId: 1, parentEntityId: 3, ownerCharacterId: 1 });
    expect(stepped.state.helpers.entries[3]).toMatchObject({ rootEntityId: 2, parentEntityId: 4, ownerCharacterId: 2 });
    expect(stepped.traces.slice(2).map((trace) => trace.entityId)).toEqual([3, 4]);

    state = stepCnsPhysicsMotion(stepped.state, cns);
    const destroyed = stepCnsStateRuntime(state, cns);
    expect(destroyed.state.helpers.entries.map((helper) => helper.helperId)).toEqual([200, 200]);
    expect(destroyed.state.hitDiagnosticLines?.join('\n')).toContain('event=destroy entityId=3');
  });

  it('clears every Helper and resets the allocator on round restart', () => {
    const spawned = stepCnsStateRuntime(createInitialGameState(), cns).state;
    expect(spawned.helpers.entries).toHaveLength(2);
    expect(restartRound(1).gameState.helpers).toEqual({ entries: [], nextEntityId: 3 });
  });

  it('evaluates NumHelper(id) and IsHelper from the current entity context', () => {
    const player = createInitialGameState().players[0];
    expect(evaluateCnsRuntimeTrigger('NumHelper(100) = 2', { player, numHelper: (id) => id === 100 ? 2 : 0 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IsHelper = 1', { player, isHelper: true })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IsHelper = 0', { player, isHelper: false })).toBe(true);
  });

  it('applies special States only within the WinMUGEN Helper keyctrl scope', () => {
    const specialStateCns = parseCnsText(`
[StateDef -3]
[State -3, Root global]
type = VarAdd
trigger1 = 1
v = 0
value = 100

[StateDef -2]
[State -2, Root global]
type = VarAdd
trigger1 = 1
v = 0
value = 10

[StateDef -1]
[State -1, Helper command marker]
type = VarAdd
trigger1 = 1
v = 0
value = 1

[State -1, Helper command route]
type = ChangeState
trigger1 = command = "go"
value = 200

[StateDef 100]
type = S
physics = N

[State 100, Current only]
type = VarSet
trigger1 = 1
v = 1
value = 100

[StateDef 200]
type = S
physics = N

[State 200, Routed current]
type = VarSet
trigger1 = 1
v = 1
value = 200
`);
    const initial = createInitialGameState();
    const frozenRoots = initial.players.map((player) => ({ ...player, hitPause: 1 })) as typeof initial.players;
    const helperRequest = (rootEntityId: 1 | 2, keyCtrl: boolean) => ({
      helperId: 100,
      rootEntityId,
      parentEntityId: rootEntityId,
      ownerCharacterId: rootEntityId,
      stateOwnerId: rootEntityId,
      animationOwnerId: rootEntityId,
      stateNo: 100,
      x: frozenRoots[rootEntityId - 1].x,
      y: frozenRoots[rootEntityId - 1].y,
      facing: frozenRoots[rootEntityId - 1].facing,
      keyCtrl,
      ownPal: false,
      spawnFrame: 0,
      parent: frozenRoots[rootEntityId - 1],
    });
    let helpers = spawnHelper(initial.helpers, helperRequest(1, false), specialStateCns);
    helpers = spawnHelper(helpers, helperRequest(2, true), specialStateCns);

    const result = stepCnsStateRuntime({ ...initial, players: frozenRoots, helpers }, specialStateCns, {
      p1Commands: new Set(['go']),
      p2Commands: new Set(['go']),
    });
    const [withoutKeyCtrl, withKeyCtrl] = result.state.helpers.entries;

    expect(withoutKeyCtrl.player).toMatchObject({ stateNo: 100, vars: { 1: 100 } });
    expect((withoutKeyCtrl.player as { vars?: Record<number, number> }).vars?.[0]).toBeUndefined();
    expect(withKeyCtrl.player).toMatchObject({ stateNo: 200, vars: { 0: 1, 1: 200 } });
    expect(result.traces.find((trace) => trace.entityId === withoutKeyCtrl.entityId)?.executedControllers).toEqual(['VarSet']);
    expect(result.traces.find((trace) => trace.entityId === withKeyCtrl.entityId)?.executedControllers).toEqual(['VarAdd', 'ChangeState', 'VarSet']);
  });

  it('uses the Helper runtime entity id for Pause movetime ownership', () => {
    const pauseCns = parseCnsText(`
[StateDef 100]
type = S
physics = N
[State 100, Move]
type = PosAdd
trigger1 = 1
x = 5
`);
    const initial = createInitialGameState();
    const helpers = spawnHelper(initial.helpers, {
      helperId: 100, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 100, x: 100, y: 0,
      facing: 1, keyCtrl: false, ownPal: false, spawnFrame: 0, parent: initial.players[0],
    }, pauseCns);
    const state = { ...initial, helpers };

    const helperOwned = stepCnsStateRuntime(state, pauseCns, {
      pauseState: startPause(createInitialPauseState(), 2, 1, 3),
    });
    expect(helperOwned.state.helpers.entries[0].player.x).toBe(105);
    expect(helperOwned.traces.find((trace) => trace.entityId === 3)?.executedControllers).toContain('PosAdd');

    const rootOwned = stepCnsStateRuntime(state, pauseCns, {
      pauseState: startPause(createInitialPauseState(), 2, 1, 1),
    });
    expect(rootOwned.state.helpers.entries[0].player.x).toBe(100);
    expect(rootOwned.traces.find((trace) => trace.entityId === 3)?.debugLines.join('\n')).toContain('global_pause skip');
  });

  it('runs Helper CNS while its Helper pausemovetime allowance remains', () => {
    const pauseCns = parseCnsText(`
[StateDef 100]
type = S
physics = N
[State 100, Move]
type = PosAdd
trigger1 = 1
x = 5
`);
    const initial = createInitialGameState();
    const helpers = spawnHelper(initial.helpers, {
      helperId: 100, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 100, x: 100, y: 0,
      facing: 1, keyCtrl: false, ownPal: false, pauseMoveTime: 1,
      spawnFrame: 0, parent: initial.players[0],
    }, pauseCns);

    const result = stepCnsStateRuntime({ ...initial, helpers }, pauseCns, {
      pauseState: startPause(createInitialPauseState(), 2, 0, 2),
    });

    expect(result.state.helpers.entries[0].player.x).toBe(105);
    expect(result.traces.find((trace) => trace.entityId === 3)?.executedControllers).toContain('PosAdd');
  });
});
