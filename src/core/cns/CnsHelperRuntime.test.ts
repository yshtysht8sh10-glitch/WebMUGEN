import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { restartRound } from '../engine/RoundRestart';
import { applyExplodControllerEvents, type ExplodControllerEvent } from '../explod/ExplodSystem';
import { spawnHelper, WINMUGEN_HELPER_MAX } from '../helper/HelperSystem';
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

  it('spawns P1/P2 helpers and runs their initial State pass on the creation frame', () => {
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime(initial, cns);

    expect(result.state.helpers.entries).toHaveLength(4);
    expect(result.state.helpers.entries.map((helper) => helper.entityId)).toEqual([3, 4, 5, 6]);
    expect(result.state.helpers.entries.map((helper) => helper.helperId)).toEqual([100, 100, 200, 200]);
    expect(result.state.helpers.entries[0]).toMatchObject({
      rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1,
      pauseMoveTime: 12, superMoveTime: 34,
      hasCompletedInitialStatePass: true,
      canRenderBeforeInitialStatePass: false,
    });
    expect(result.state.helpers.entries[1]).toMatchObject({
      rootEntityId: 2, parentEntityId: 2, ownerCharacterId: 2,
    });
    expect(result.state.helpers.entries[0].player).toMatchObject({
      stateNo: 100, stateTime: 0, animNo: 1001, animTime: 0,
      sprPriority: 0,
      collisionWidth: { xScale: 0.5, yScale: 0.75 },
    });
    expect(result.traces).toHaveLength(6);
    expect(result.state.hitDiagnosticLines?.join('\n')).toContain('firstStep=creation_frame');
    expect(result.state.hitDiagnosticLines?.join('\n')).toContain('creationRender=immediate');
  });

  it('makes a queued Helper visible to later NumHelper checks in the same tick', () => {
    const initial = createInitialGameState();
    const request = {
      helperId: 100,
      rootEntityId: 1 as const,
      parentEntityId: 1,
      ownerCharacterId: 1 as const,
      stateOwnerId: 1 as const,
      animationOwnerId: 1 as const,
      stateNo: 100,
      x: initial.players[0].x,
      y: initial.players[0].y,
      facing: 1 as const,
      keyCtrl: false,
      ownPal: false,
      spawnFrame: 0,
      parent: initial.players[0],
    };
    let helpers = spawnHelper(initial.helpers, request, cns);
    helpers = spawnHelper(helpers, request, cns);

    const result = stepCnsStateRuntime({ ...initial, helpers }, cns);

    expect(result.state.helpers.entries.filter((helper) => helper.helperId === 200)).toHaveLength(2);
    expect(result.traces.filter((trace) => trace.entityId !== undefined)
      .flatMap((trace) => trace.executedControllers)
      .filter((controller) => controller === 'Helper')).toHaveLength(2);
  });

  it('starts Helper sprpriority independently from the parent and honors the initial StateDef value', () => {
    const priorityCns = parseCnsText(`
[StateDef 0]
type = S
physics = N

[State 0, Default priority Helper]
type = Helper
trigger1 = time = 0
id = 100
stateno = 100

[State 0, Explicit priority Helper]
type = Helper
trigger1 = time = 0
id = 200
stateno = 200

[StateDef 100]
type = S
physics = N

[StateDef 200]
type = S
physics = N
sprpriority = -3
`);
    const initial = createInitialGameState();
    const state = stepCnsStateRuntime({
      ...initial,
      players: initial.players.map((player) => ({ ...player, sprPriority: 5 })) as typeof initial.players,
    }, priorityCns).state;

    expect(state.helpers.entries.map((helper) => ({
      id: helper.helperId,
      sprPriority: helper.player.sprPriority,
    }))).toEqual([
      { id: 100, sprPriority: 0 },
      { id: 200, sprPriority: -3 },
      { id: 100, sprPriority: 0 },
      { id: 200, sprPriority: -3 },
    ]);
  });

  it('lets a Helper observe its root parent at the frame-start State transition boundary', () => {
    const transitionCns = parseCnsText(`
[StateDef 0]
type = S
physics = N

[StateDef 100]
type = S
physics = N

[State 100, Finish]
type = ChangeState
trigger1 = time = 5
value = 101

[StateDef 101]
type = S
physics = N

[StateDef 200]
type = S
physics = N

[State 200, Parent finished]
type = DestroySelf
trigger1 = parent,stateno = 100
trigger1 = parent,time = 5
`);
    const initial = createInitialGameState();
    const p1 = {
      ...initial.players[0],
      stateNo: 100,
      stateHeaderAppliedStateNo: 100,
      stateTime: 5,
    };
    const helpers = spawnHelper(initial.helpers, {
      helperId: 200,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 200,
      x: p1.x,
      y: p1.y,
      facing: p1.facing,
      keyCtrl: false,
      ownPal: false,
      spawnFrame: 0,
      parent: p1,
    }, transitionCns);

    const result = stepCnsStateRuntime({ ...initial, players: [p1, initial.players[1]], helpers }, transitionCns);

    expect(result.state.players[0].stateNo).toBe(101);
    expect(result.state.helpers.entries).toHaveLength(0);
    expect(result.traces.find((trace) => trace.entityId === 3)?.executedControllers).toContain('DestroySelf');
  });

  it('converts screen-edge postypes into world coordinates once for both facings', () => {
    const edgeCns = parseCnsText(`
[StateDef 0]
type = S
physics = N
[State 0, Edge]
type = Helper
trigger1 = 1
id = 900
stateno = 100
pos = 10, -5
postype = front
`);
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime(initial, edgeCns, { screenWidth: 400, cameraX: 120, cameraY: 45 });

    expect(result.state.helpers.entries.map((helper) => ({
      root: helper.rootEntityId,
      x: helper.player.x,
      y: helper.player.y,
      facing: helper.player.facing,
    }))).toEqual([
      { root: 1, x: 530, y: 280, facing: 1 },
      { root: 2, x: 110, y: 280, facing: -1 },
    ]);
  });

  it('runs nested Helper State/Anim on the creation frame, supports parent identity, NumHelper, and DestroySelf', () => {
    let state = stepCnsStateRuntime(createInitialGameState(), cns).state;
    expect(state.helpers.entries.every((helper) => helper.hasCompletedInitialStatePass)).toBe(true);
    state = stepCnsPhysicsMotion(state, cns);
    expect(state.helpers.entries[0].player.stateTime).toBe(1);
    expect(state.helpers.entries[0].hasCompletedInitialStatePass).toBe(true);
    expect(state.helpers.entries[2].player.stateTime).toBe(1);
    expect(state.helpers.entries[2].hasCompletedInitialStatePass).toBe(true);

    const stepped = stepCnsStateRuntime(state, cns);
    expect(stepped.state.helpers.entries.every((helper) => helper.hasCompletedInitialStatePass)).toBe(true);
    expect(stepped.state.helpers.entries).toHaveLength(2);
    expect(stepped.state.helpers.entries.map((helper) => helper.helperId)).toEqual([200, 200]);
    expect(stepped.state.helpers.entries[0]).toMatchObject({ rootEntityId: 1, parentEntityId: 3, ownerCharacterId: 1 });
    expect(stepped.state.helpers.entries[1]).toMatchObject({ rootEntityId: 2, parentEntityId: 4, ownerCharacterId: 2 });
    expect(stepped.traces.slice(2).map((trace) => trace.entityId)).toEqual([5, 3, 6, 4]);

    const destroyed = stepped;
    expect(destroyed.state.helpers.entries.map((helper) => helper.helperId)).toEqual([200, 200]);
    expect(destroyed.state.hitDiagnosticLines?.join('\n')).toContain('event=destroy entityId=3');
  });

  it('runs parent, child, and grandchild Helper initial States in one creation-frame FIFO', () => {
    const generationCns = parseCnsText(`
[StateDef 0]
type = S
physics = N

[State 0, Parent Helper]
type = Helper
trigger1 = time = 0
id = 100
stateno = 100

[StateDef 100]
type = S
physics = N

[State 100, Child Helper]
type = Helper
trigger1 = time = 0
id = 200
stateno = 200

[StateDef 200]
type = S
physics = N

[State 200, Grandchild Helper]
type = Helper
trigger1 = time = 0
id = 300
stateno = 300

[StateDef 300]
type = A
physics = N

[State 300, Initial velocity]
type = VelSet
trigger1 = time = 0
x = 7
y = -2
`);
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [initial.players[0], { ...initial.players[1], stateTime: 1 }],
    }, generationCns);

    expect(result.state.helpers.entries.map((helper) => helper.helperId)).toEqual([100, 200, 300]);
    expect(result.state.helpers.entries.map((helper) => helper.parentEntityId)).toEqual([1, 3, 4]);
    expect(result.state.helpers.entries.every((helper) => helper.hasCompletedInitialStatePass)).toBe(true);
    expect(result.state.helpers.entries[2].player).toMatchObject({ vx: 7, vy: -2, stateTime: 0 });
    expect(result.traces.slice(2).map((trace) => trace.entityId)).toEqual([3, 4, 5]);
  });

  it('bounds same-frame recursive Helper creation with WinMUGEN HelperMax', () => {
    const recursiveCns = parseCnsText(`
[StateDef 0]
type = S
physics = N

[State 0, Seed]
type = Helper
trigger1 = time = 0
id = 100
stateno = 100

[StateDef 100]
type = S
physics = N

[State 100, Replicate]
type = Helper
trigger1 = 1
id = 100
stateno = 100
`);
    const result = stepCnsStateRuntime(createInitialGameState(), recursiveCns);

    expect(result.state.helpers.entries).toHaveLength(WINMUGEN_HELPER_MAX);
    expect(result.state.helpers.entries.every((helper) => helper.hasCompletedInitialStatePass)).toBe(true);
    expect(result.state.hitDiagnosticLines?.join('\n')).toContain(`result=helpermax limit=${WINMUGEN_HELPER_MAX}`);
  });

  it('lets a creation-frame Helper read root AnimElem and apply VelSet before Physics=N motion', () => {
    const introCns = parseCnsText(`
[StateDef 0]
type = S
physics = N
anim = 10

[State 0, Ball]
type = Helper
trigger1 = AnimElem = 1
id = 2000
stateno = 2000
pos = 22, -17

[StateDef 2000]
type = A
movetype = I
physics = N
anim = 2000

[State 2000, Gravity]
type = VelAdd
trigger1 = 1
y = .15

[State 2000, Launch]
type = VelSet
trigger1 = root, AnimElem = 1
x = .15
y = -3.2
`);
    const animationInfo = (_animNo: number, animTime: number) => ({
      elementNo: 1,
      elementTime: animTime,
      elementStarted: animTime === 0,
      elementCount: 1,
      elementTimes: [0],
    });
    const initial = createInitialGameState();
    const created = stepCnsStateRuntime(initial, introCns, { getAnimationTriggerInfo: animationInfo }).state;
    const p1Ball = created.helpers.entries.find((helper) => helper.rootEntityId === 1)!;

    expect(p1Ball.player).toMatchObject({
      stateNo: 2000,
      stateTime: 0,
      physics: 'N',
      x: initial.players[0].x + 22,
      y: initial.players[0].y - 17,
      vx: 0.15,
      vy: -3.2,
    });

    const moved = stepCnsPhysicsMotion(created, introCns);
    expect(moved.helpers.entries.find((helper) => helper.entityId === p1Ball.entityId)?.player).toMatchObject({
      stateTime: 1,
      x: initial.players[0].x + 22.15,
      y: initial.players[0].y - 20.2,
      vx: 0.15,
      vy: -3.2,
    });

    const accelerated = stepCnsStateRuntime(moved, introCns, { getAnimationTriggerInfo: animationInfo }).state;
    expect(accelerated.helpers.entries.find((helper) => helper.entityId === p1Ball.entityId)?.player.vy).toBeCloseTo(-3.05);
  });

  it('creates the intro ball when a same-tick ChangeState chain reaches State 191 AnimElem 1', () => {
    const introChainCns = parseCnsText(`
[StateDef 5900]
type = S
physics = N
anim = 5900

[State 5900, Select intro]
type = ChangeState
trigger1 = time = 0
value = 190

[StateDef 190]
type = S
physics = N
anim = 190

[State 190, Character intro]
type = ChangeState
trigger1 = time = 0
value = 191

[StateDef 191]
type = S
physics = S
anim = 190

[State 191, Ball]
type = Helper
trigger1 = AnimElem = 1
id = 2000
stateno = 2000
pos = 22, -17
size.xscale = .5
size.yscale = .5

[StateDef 2000]
type = A
physics = N
anim = 2000

[State 2000, Gravity]
type = VelAdd
trigger1 = 1
y = .15

[State 2000, Launch]
type = VelSet
trigger1 = root, AnimElem = 1
x = .15
y = -3.2
`);
    const animationInfo = (_animNo: number, animTime: number) => ({
      elementNo: 1,
      elementTime: animTime,
      elementStarted: animTime === 0,
      elementCount: 1,
      elementTimes: [0],
    });
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: initial.players.map((player) => ({
        ...player,
        stateNo: 5900,
        stateTime: 0,
        animNo: 5900,
        animTime: 0,
      })) as typeof initial.players,
    }, introChainCns, { getAnimationTriggerInfo: animationInfo });

    expect(result.state.players.map((player) => player.stateNo)).toEqual([191, 191]);
    expect(result.state.helpers.entries.map((helper) => helper.helperId)).toEqual([2000, 2000]);
    expect(result.state.helpers.entries[0].player).toMatchObject({
      stateNo: 2000,
      stateTime: 0,
      vx: 0.15,
      vy: -3.2,
      collisionWidth: { xScale: 0.5, yScale: 0.5 },
    });
    expect(result.traces[0].executedControllers).toEqual(['ChangeState', 'ChangeState', 'Helper']);
  });

  it('keeps Helper Explod ownership through RemoveExplod and DestroySelf', () => {
    const explodCns = parseCnsText(`
[StateDef 0]
type = S
physics = N

[State 0, Root Explod]
type = Explod
trigger1 = time = 0
anim = 10
id = 77
bindtime = -1
removetime = -1

[State 0, Spawn]
type = Helper
trigger1 = time = 0
id = 100
stateno = 100

[StateDef 100]
type = S
physics = N

[State 100, Helper Explod]
type = Explod
trigger1 = time = 0
anim = 10
id = 77
bindtime = 0
removetime = -1

[State 100, Modify owned Explod]
type = ModifyExplod
trigger1 = time = 0
id = 77
pos = 5, -6
bindtime = 2

[State 100, Rebind owned Explod]
type = ExplodBindTime
trigger1 = time = 0
id = 77
time = -1

[State 100, Remove owned Explod]
type = RemoveExplod
trigger1 = time = 1
id = 77

[State 100, Destroy]
type = DestroySelf
trigger1 = time = 1
`);
    let state = createInitialGameState();

    let events: ExplodControllerEvent[] = [];
    let result = stepCnsStateRuntime(state, explodCns, explodCallbacks(events));
    state = applyExplodControllerEvents(result.state, events);
    expect(state.explods.entries).toHaveLength(4);
    expect(state.explods.entries.map((entry) => entry.owner.entityId)).toEqual([1, 2, 3, 4]);

    state = stepCnsPhysicsMotion(state, explodCns);
    events = [];
    result = stepCnsStateRuntime(state, explodCns, explodCallbacks(events));
    state = applyExplodControllerEvents(result.state, events);
    expect(state.helpers.entries).toHaveLength(0);
    expect(state.explods.entries.map((entry) => entry.owner.entityId)).toEqual([1, 2]);
    expect(state.hitDiagnosticLines?.join('\n')).toContain('raw.explod_remove owner=p1 id=77 matched=1');
    expect(state.hitDiagnosticLines?.join('\n')).toContain('raw.explod_remove owner=p2 id=77 matched=1');
  });

  it('clears every Helper and resets the allocator on round restart', () => {
    const spawned = stepCnsStateRuntime(createInitialGameState(), cns).state;
    expect(spawned.helpers.entries).toHaveLength(4);
    expect(restartRound(1).gameState.helpers).toEqual({ entries: [], nextEntityId: 3 });
  });

  it('evaluates NumHelper(id) and IsHelper from the current entity context', () => {
    const player = createInitialGameState().players[0];
    expect(evaluateCnsRuntimeTrigger('NumHelper(100) = 2', { player, numHelper: (id) => id === 100 ? 2 : 0 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IsHelper = 1', { player, isHelper: true })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IsHelper = 0', { player, isHelper: false })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IsHelper(1101) = 1', { player, isHelper: true, helperId: 1101 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IsHelper(1102) = 0', { player, isHelper: true, helperId: 1101 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IsHelper(1100 + 1) = 1', { player, isHelper: true, helperId: 1101 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IsHelper(1101) = 0', { player, isHelper: false })).toBe(true);

    const helper = { ...player, helperId: 1101, vars: { 9: 108 } };
    const redirectContext = {
      player: helper,
      isHelper: true,
      helperId: 1101,
      resolveRedirectEntity: (kind: 'root' | 'parent' | 'helper' | 'playerid' | 'partner', id?: number) => (
        kind === 'helper' && id === 1101 ? helper : undefined
      ),
    };
    expect(evaluateCnsRuntimeTrigger('helper(1101),var(9) >= helper(1102),var(9)', redirectContext)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('helper(1102),var(9) >= helper(1103),var(9)', redirectContext)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('helper(1102),var(9) = 0', redirectContext)).toBe(false);
    expect(evaluateCnsRuntimeTrigger('helper(1102),var(9) != 0', redirectContext)).toBe(false);
  });

  it('commits Helper TargetState and exposes it to a later target redirect in the same State pass', () => {
    const redirectCns = parseCnsText(`
[StateDef 0]
type = S
physics = N

[StateDef 3720]
type = A
physics = N
[State 3720, observe helper]
type = ChangeState
trigger1 = helper(3725),stateno = 3735
value = 3730

[StateDef 3725]
type = S
movetype = A
physics = N
[State 3725, custom target state]
type = TargetState
trigger1 = MoveHit = 1
value = 3738
[State 3725, advance helper]
type = ChangeState
trigger1 = MoveHit = 1
trigger1 = target(3725),stateno = 3738
value = 3735

[StateDef 3730]
type = A
physics = N
[StateDef 3735]
type = S
physics = N
[StateDef 3738]
type = A
movetype = H
physics = N
`);
    const initial = createInitialGameState();
    initial.players[0] = { ...initial.players[0], stateNo: 3720 };
    let helpers = spawnHelper(initial.helpers, {
      helperId: 3725, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 3725, x: 100, y: 0,
      facing: 1, keyCtrl: false, ownPal: false, spawnFrame: 0, parent: initial.players[0],
    }, redirectCns);
    helpers = {
      ...helpers,
      entries: helpers.entries.map((helper) => ({
        ...helper,
        player: {
          ...helper.player,
          targets: [{ playerId: 2, hitDefId: 3725, activeHitDefId: 1 }],
          moveContact: {
            activeHitDefId: 1, contact: true, hit: true, guarded: false, elapsed: 1, hitCount: 1,
          },
        },
      })),
    };

    const helperPass = stepCnsStateRuntime({ ...initial, helpers }, redirectCns);
    expect(helperPass.state.helpers.entries[0].player.stateNo).toBe(3735);
    expect(helperPass.state.players[1]).toMatchObject({ stateNo: 3738, stateOwnerId: 1 });
    expect(helperPass.traces.find((trace) => trace.entityId === 3)?.executedControllers)
      .toEqual(expect.arrayContaining(['TargetState', 'ChangeState']));

    const rootPass = stepCnsStateRuntime(helperPass.state, redirectCns);
    expect(rootPass.state.players[0].stateNo).toBe(3730);
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

  it('exposes root commands through a redirected keyctrl Helper command trigger', () => {
    const commandRedirectCns = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[StateDef 210]
type = S
movetype = A
physics = S
anim = 210
ctrl = 0

[StateDef 99999]
type = S
movetype = I
physics = N
anim = 0
ctrl = 0

[Statedef -1]

[State -1, D4meirin-style Helper command route]
type = ChangeState
triggerall = !ishelper
triggerall = helper(99999), command = "a"
trigger1 = statetype != A
trigger1 = ctrl
value = 210
`);
    const initial = createInitialGameState();
    const createState = (keyCtrl: boolean) => ({
      ...initial,
      helpers: spawnHelper(initial.helpers, {
        helperId: 99999, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
        stateOwnerId: 1, animationOwnerId: 1, stateNo: 99999,
        x: initial.players[0].x, y: initial.players[0].y, facing: 1,
        keyCtrl, ownPal: false, spawnFrame: 0, parent: initial.players[0],
      }, commandRedirectCns),
    });

    const enabled = stepCnsStateRuntime(createState(true), commandRedirectCns, {
      p1Commands: new Set(['a']), p2Commands: new Set(),
    });
    const disabled = stepCnsStateRuntime(createState(false), commandRedirectCns, {
      p1Commands: new Set(['a']), p2Commands: new Set(),
    });

    expect(enabled.state.players[0]).toMatchObject({ stateNo: 210, animNo: 210, moveType: 'A', ctrl: false });
    expect(disabled.state.players[0]).toMatchObject({ stateNo: 0, animNo: 0, moveType: 'I', ctrl: true });
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

  it('shares the root Power gauge with Helpers', () => {
    const powerCns = parseCnsText(`
[StateDef 100]
type = S
physics = N
[State 100, Read shared Power]
type = VarSet
trigger1 = 1
v = 0
value = Power
[State 100, Spend shared Power]
type = PowerAdd
trigger1 = 1
value = -100
`);
    const initial = createInitialGameState();
    initial.players[0] = { ...initial.players[0], power: 1800 };
    const helpers = spawnHelper(initial.helpers, {
      helperId: 2200, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 100, x: 100, y: 0,
      facing: 1, keyCtrl: false, ownPal: false, spawnFrame: 0, parent: initial.players[0],
    }, powerCns);

    const result = stepCnsStateRuntime({ ...initial, helpers }, powerCns);

    expect(result.state.helpers.entries[0].player.vars?.[0]).toBe(1800);
    expect(result.state.helpers.entries[0].player.power).toBe(1700);
    expect(result.state.players[0].power).toBe(1700);
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

function explodCallbacks(events: ExplodControllerEvent[]) {
  return {
    onExplodCreate: (event: Extract<ExplodControllerEvent, { type: 'create' | 'rejected' }>) => events.push(event),
    onExplodModify: (event: Extract<ExplodControllerEvent, { type: 'modify' }>) => events.push(event),
    onExplodRemove: (event: Extract<ExplodControllerEvent, { type: 'remove' }>) => events.push(event),
    onExplodBindTime: (event: Extract<ExplodControllerEvent, { type: 'bindtime' }>) => events.push(event),
  };
}
