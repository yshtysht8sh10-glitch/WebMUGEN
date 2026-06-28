import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('CnsStateRuntime AnimTime', () => {
  it('returns from state 200 when MUGEN AnimTime reaches 0', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S
ctrl = 0
anim = 200

[State 200, Return]
type = ChangeState
trigger1 = AnimTime = 0
value = 0
ctrl = 1

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 200, animNo: 200, animTime: 10, stateTime: 10, moveType: 'A', ctrl: false },
          state.players[1],
        ],
      },
      cns,
      {
        getAnimationDuration: (animNo) => (animNo === 200 ? 10 : null),
      },
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 0,
      animNo: 0,
      moveType: 'I',
      ctrl: true,
    });
    expect(result.traces[0]).toMatchObject({
      mugenAnimTime: 0,
      executedControllers: ['ChangeState'],
    });
  });

  it('does not return before MUGEN AnimTime reaches 0', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S
ctrl = 0
anim = 200

[State 200, Return]
type = ChangeState
trigger1 = AnimTime = 0
value = 0

[Statedef 0]
anim = 0
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 200, animNo: 200, animTime: 9, stateTime: 9 },
          state.players[1],
        ],
      },
      cns,
      {
        getAnimationDuration: (animNo) => (animNo === 200 ? 10 : null),
      },
    );

    expect(result.state.players[0].stateNo).toBe(200);
    expect(result.traces[0].mugenAnimTime).toBe(1);
  });

  it('re-enters state 0 with idle animation even when the target StateDef omits anim', () => {
    const cns = parseCnsText(`
[Statedef 52]
type = S
movetype = I
physics = S
ctrl = 0
anim = 47

[State 52, EndLanding]
type = ChangeState
trigger1 = time > 5
value = 0

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          {
            ...state.players[0],
            stateNo: 52,
            animNo: 47,
            animTime: 96,
            stateTime: 96,
            stateType: 'S',
            moveType: 'I',
            physics: 'S',
            ctrl: false,
          },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 0,
      animNo: 0,
      animTime: 0,
      stateTime: 0,
      stateType: 'S',
      moveType: 'I',
      physics: 'S',
      ctrl: true,
    });
  });

  it('preserves the current animation when entering an animless non-idle state', () => {
    const cns = parseCnsText(`
[Statedef 40]
type = A
movetype = I
physics = A
ctrl = 0
anim = 40

[State 40, ToJumpUp]
type = ChangeState
trigger1 = time > 3
value = 50

[Statedef 50]
type = A
movetype = I
physics = A
ctrl = 0
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          {
            ...state.players[0],
            stateNo: 40,
            animNo: 40,
            animTime: 4,
            stateTime: 4,
            stateType: 'A',
            moveType: 'I',
            physics: 'A',
            ctrl: false,
          },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 50,
      animNo: 40,
      animTime: 4,
      stateTime: 0,
      stateType: 'A',
      moveType: 'I',
      physics: 'A',
      ctrl: false,
    });
  });
});

describe('CnsStateRuntime state controllers', () => {
  it('executes State -3 before State -2 and State -1', () => {
    const cns = parseCnsText(`
[Statedef -3]
[State -3, MarkGlobal]
type = VarSet
trigger1 = 1
v = 0
value = 3

[Statedef -2]
[State -2, SeeGlobal]
type = VarAdd
trigger1 = var(0) = 3
v = 0
value = 2

[Statedef -1]
[State -1, RouteAfterGlobals]
type = ChangeState
trigger1 = var(0) = 5
value = 20

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0

[Statedef 20]
type = S
movetype = I
physics = S
ctrl = 1
anim = 20
`);

    const result = stepCnsStateRuntime(createInitialGameState(), cns);

    expect(result.state.players[0].stateNo).toBe(20);
    expect((result.state.players[0] as { vars?: Record<number, number> }).vars?.[0]).toBe(5);
    expect(result.traces[0].executedControllers).toEqual(['VarSet', 'VarAdd', 'ChangeState']);
  });

  it('recognizes WinMUGEN state controllers that have runtime shims', () => {
    const controllerBlocks = recognizedControllerFixtures
      .map(({ type, params }) => `
[State 0, ${type}]
type = ${type}
trigger1 = 1
${params ?? ''}
`)
      .join('\n');
    const cns = parseCnsText(`
[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0
${controllerBlocks}
`);

    const result = stepCnsStateRuntime(createInitialGameState(), cns);

    expect(result.traces[0].executedControllers).toEqual(expect.arrayContaining(
      recognizedControllerFixtures.map(({ traceName }) => traceName),
    ));
  });
});

const recognizedControllerFixtures: { type: string; traceName: string; params?: string }[] = [
  { type: 'Null', traceName: 'Null' },
  { type: 'AfterImage', traceName: 'AfterImage' },
  { type: 'AfterImageTime', traceName: 'AfterImageTime', params: 'time = 4' },
  { type: 'AllPalFX', traceName: 'AllPalFX' },
  { type: 'AngleAdd', traceName: 'AngleAdd', params: 'value = 1' },
  { type: 'AngleDraw', traceName: 'AngleDraw' },
  { type: 'AngleMul', traceName: 'AngleMul', params: 'value = 1' },
  { type: 'AngleSet', traceName: 'AngleSet', params: 'value = 0' },
  { type: 'AppendToClipboard', traceName: 'AppendToClipboard' },
  { type: 'AssertSpecial', traceName: 'AssertSpecial' },
  { type: 'AttackDist', traceName: 'AttackDist' },
  { type: 'AttackMulSet', traceName: 'AttackMulSet', params: 'value = 1' },
  { type: 'BGPalFX', traceName: 'BGPalFX' },
  { type: 'BindToParent', traceName: 'BindToParent' },
  { type: 'BindToRoot', traceName: 'BindToRoot' },
  { type: 'BindToTarget', traceName: 'BindToTarget' },
  { type: 'ChangeAnim', traceName: 'ChangeAnim', params: 'value = 0' },
  { type: 'ChangeAnim2', traceName: 'ChangeAnim2' },
  { type: 'ChangeState', traceName: 'ChangeState', params: 'value = 0' },
  { type: 'ClearClipboard', traceName: 'ClearClipboard' },
  { type: 'CtrlSet', traceName: 'CtrlSet', params: 'value = 1' },
  { type: 'DefenceMulSet', traceName: 'DefenceMulSet', params: 'value = 1' },
  { type: 'DestroySelf', traceName: 'DestroySelf' },
  { type: 'DisplayToClipboard', traceName: 'DisplayToClipboard' },
  { type: 'EnvColor', traceName: 'EnvColor' },
  { type: 'EnvShake', traceName: 'EnvShake' },
  { type: 'Explod', traceName: 'Explod' },
  { type: 'ExplodBindTime', traceName: 'ExplodBindTime' },
  { type: 'ForceFeedback', traceName: 'ForceFeedback' },
  { type: 'GameMakeAnim', traceName: 'GameMakeAnim' },
  { type: 'Gravity', traceName: 'Gravity' },
  { type: 'Helper', traceName: 'Helper' },
  { type: 'HitAdd', traceName: 'HitAdd', params: 'value = 1' },
  { type: 'HitBy', traceName: 'HitBy', params: 'value = SCA, NA, SA, HA, NP, SP, HP' },
  { type: 'HitDef', traceName: 'HitDef' },
  { type: 'HitFallSet', traceName: 'HitFallSet' },
  { type: 'HitFallVel', traceName: 'HitFallVel', params: 'y = -2' },
  { type: 'HitOverride', traceName: 'HitOverride' },
  { type: 'HitVelSet', traceName: 'HitVelSet', params: 'x = 1\ny = -1' },
  { type: 'LifeAdd', traceName: 'LifeAdd', params: 'value = 0' },
  { type: 'LifeSet', traceName: 'LifeSet', params: 'value = 1000' },
  { type: 'ModifyExplod', traceName: 'ModifyExplod' },
  { type: 'MoveHitReset', traceName: 'MoveHitReset' },
  { type: 'NotHitBy', traceName: 'NotHitBy', params: 'value = SCA, NA, SA, HA, NP, SP, HP' },
  { type: 'Offset', traceName: 'Offset', params: 'x = 0\ny = 0' },
  { type: 'PalFX', traceName: 'PalFX' },
  { type: 'ParentVarAdd', traceName: 'ParentVarAdd' },
  { type: 'ParentVarSet', traceName: 'ParentVarSet' },
  { type: 'Pause', traceName: 'Pause', params: 'time = 1' },
  { type: 'PlayerPush', traceName: 'PlayerPush', params: 'value = 1' },
  { type: 'PlaySnd', traceName: 'PlaySnd' },
  { type: 'PosAdd', traceName: 'PosAdd', params: 'x = 0\ny = 0' },
  { type: 'PosFreeze', traceName: 'PosFreeze' },
  { type: 'PosSet', traceName: 'PosSet', params: 'x = 220\ny = 285' },
  { type: 'PowerAdd', traceName: 'PowerAdd', params: 'value = 0' },
  { type: 'PowerSet', traceName: 'PowerSet', params: 'value = 0' },
  { type: 'Projectile', traceName: 'Projectile' },
  { type: 'RemoveExplod', traceName: 'RemoveExplod' },
  { type: 'ReversalDef', traceName: 'ReversalDef' },
  { type: 'ScreenBound', traceName: 'ScreenBound' },
  { type: 'SelfState', traceName: 'SelfState', params: 'value = 0' },
  { type: 'SprPriority', traceName: 'SprPriority', params: 'value = 0' },
  { type: 'StateTypeSet', traceName: 'StateTypeSet', params: 'statetype = S\nmovetype = I\nphysics = S' },
  { type: 'StopSnd', traceName: 'StopSnd' },
  { type: 'SndPan', traceName: 'SndPan' },
  { type: 'SuperPause', traceName: 'SuperPause', params: 'time = 1' },
  { type: 'TargetBind', traceName: 'TargetBind' },
  { type: 'TargetDrop', traceName: 'TargetDrop' },
  { type: 'TargetFacing', traceName: 'TargetFacing' },
  { type: 'TargetLifeAdd', traceName: 'TargetLifeAdd' },
  { type: 'TargetPowerAdd', traceName: 'TargetPowerAdd' },
  { type: 'TargetState', traceName: 'TargetState' },
  { type: 'TargetVelAdd', traceName: 'TargetVelAdd' },
  { type: 'TargetVelSet', traceName: 'TargetVelSet' },
  { type: 'Trans', traceName: 'Trans', params: 'trans = none' },
  { type: 'Turn', traceName: 'Turn' },
  { type: 'VarAdd', traceName: 'VarAdd', params: 'v = 0\nvalue = 1' },
  { type: 'VarRandom', traceName: 'VarRandom', params: 'v = 1\nrange = 10' },
  { type: 'VarRangeSet', traceName: 'VarRangeSet', params: 'first = 2\nlast = 3\nvalue = 4' },
  { type: 'VarSet', traceName: 'VarSet', params: 'v = 4\nvalue = 5' },
  { type: 'VelAdd', traceName: 'VelAdd', params: 'x = 0\ny = 0' },
  { type: 'VelMul', traceName: 'VelMul', params: 'x = 1\ny = 1' },
  { type: 'VelSet', traceName: 'VelSet', params: 'x = 0\ny = 0' },
  { type: 'Width', traceName: 'Width', params: 'edge = 0\nplayer = 0' },
];
