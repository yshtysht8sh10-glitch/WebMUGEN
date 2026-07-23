import { describe, expect, it } from 'vitest';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { loadCharacterFromDef, type CharacterAssetFetcher } from './CharacterLoader';

describe('CharacterLoader command route priority', () => {
  it('does not treat directional helper commands as the primary route command', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createFetcher(new Map([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\n'],
      ['/chars/kfm/kfm.cns', `
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[StateDef 10]
type = C
movetype = I
physics = C
anim = 10
ctrl = 0

[StateDef 400]
type = C
movetype = A
physics = C
anim = 400
ctrl = 0
`],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', `
[Command]
name = "a"
command = a

[Statedef -1]

[State -1, Crouch Attack]
type = ChangeState
triggerall = command = "holddown"
trigger1 = command = "a"
trigger1 = ctrl
value = 400
`],
      ['/chars/common.cmd', `
[Command]
name = "holddown"
command = /D

[Statedef -1]

[State -1, Common Crouch Start]
type = ChangeState
triggerall = command = "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 10
`],
      ['/chars/common1.cns', '[StateDef 10]\ntype = C\nmovetype = I\nphysics = C\nanim = 10\nctrl = 0\n'],
    ])));

    const commandState = character.cns.states.find((state) => state.stateNo === -1);

    expect(commandState?.controllers.map((controller) => controller.params.value)).toEqual([10, 400]);
  });

  it('does not treat the MUGEN b attack button as the back direction command', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createFetcher(new Map([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\n'],
      ['/chars/kfm/kfm.cns', `
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[StateDef 10]
type = C
movetype = I
physics = C
anim = 10
ctrl = 0

[StateDef 440]
type = C
movetype = A
physics = C
anim = 440
ctrl = 0
`],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', `
[Command]
name = "b"
command = b

[Command]
name = "holddown"
command = /$D

[Statedef -1]

[State -1, Crouching Strong Kick]
type = ChangeState
triggerall = command = "b"
triggerall = command = "holddown"
trigger1 = statetype = C
trigger1 = ctrl
value = 440
`],
      ['/chars/common.cmd', `
[Command]
name = "holddown"
command = /D

[Statedef -1]

[State -1, Common Crouch Start]
type = ChangeState
triggerall = command = "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 10
`],
      ['/chars/common1.cns', '[StateDef 10]\ntype = C\nmovetype = I\nphysics = C\nanim = 10\nctrl = 0\n'],
    ])));

    const commandState = character.cns.states.find((state) => state.stateNo === -1);

    expect(commandState?.controllers.map((controller) => controller.params.value)).toEqual([10, 440]);
  });

  it('still lets a character override a direction-only common route', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createFetcher(new Map([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\n'],
      ['/chars/kfm/kfm.cns', '[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n\n[StateDef 41]\ntype = A\nmovetype = I\nphysics = A\nanim = 41\nctrl = 0\n'],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', `
[Command]
name = "holdup"
command = /U

[Statedef -1]

[State -1, Character Jump]
type = ChangeState
triggerall = command = "holdup"
trigger1 = ctrl
value = 41
`],
      ['/chars/common.cmd', `
[Command]
name = "holdup"
command = /U

[Statedef -1]

[State -1, Common Jump]
type = ChangeState
triggerall = command = "holdup"
trigger1 = ctrl
value = 40
`],
      ['/chars/common1.cns', '[StateDef 40]\ntype = A\nmovetype = I\nphysics = A\nanim = 40\nctrl = 0\n'],
    ])));

    const commandState = character.cns.states.find((state) => state.stateNo === -1);

    expect(commandState?.controllers.map((controller) => controller.params.value)).toEqual([41]);

    const result = stepCnsStateRuntime(createInitialGameState(), character.cns, {
      p1Commands: new Set(['holdup', 'up']),
      p2Commands: new Set(),
    });

    expect(result.state.players[0]).toMatchObject({
      stateNo: 41,
      animNo: 41,
      stateType: 'A',
      physics: 'A',
      ctrl: false,
    });
  });

  it('runs a character-defined jump variant State 42 at runtime', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createFetcher(new Map([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\n'],
      ['/chars/kfm/kfm.cns', '[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n\n[StateDef 42]\ntype = A\nmovetype = I\nphysics = A\nanim = 42\nctrl = 0\n'],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\nBegin Action 42\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', `
[Command]
name = "holdup"
command = /U

[Statedef -1]

[State -1, Character Jump Variant]
type = ChangeState
triggerall = command = "holdup"
trigger1 = ctrl
value = 42
`],
      ['/chars/common.cmd', '[Command]\nname = "holdup"\ncommand = /U\n'],
      ['/chars/common1.cns', '[StateDef 40]\ntype = A\nmovetype = I\nphysics = A\nanim = 40\nctrl = 0\n'],
    ])));

    const result = stepCnsStateRuntime(createInitialGameState(), character.cns, {
      p1Commands: new Set(['holdup', 'up']),
      p2Commands: new Set(),
    });

    expect(result.state.players[0]).toMatchObject({
      stateNo: 42,
      animNo: 42,
      stateType: 'A',
      physics: 'A',
      ctrl: false,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('runs a character-defined air jump transition State 45 at runtime', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createFetcher(new Map([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\n'],
      ['/chars/kfm/kfm.cns', '[StateDef 45]\ntype = A\nmovetype = I\nphysics = A\nanim = 45\nctrl = 0\n'],
      ['/chars/kfm/kfm.air', 'Begin Action 45\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', `
[Command]
name = "airjump"
command = /U

[Statedef -1]

[State -1, Air Jump]
type = ChangeState
triggerall = command = "airjump"
trigger1 = statetype = A
value = 45
`],
      ['/chars/common.cmd', ''],
      ['/chars/common1.cns', ''],
    ])));
    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 40, animNo: 40, stateType: 'A', physics: 'A', ctrl: false },
          state.players[1],
        ],
      },
      character.cns,
      {
        p1Commands: new Set(['airjump', 'holdup', 'up']),
        p2Commands: new Set(),
      },
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 45,
      animNo: 45,
      stateType: 'A',
      physics: 'A',
      ctrl: false,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('runs a character-defined jump down State 51 at runtime', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createFetcher(new Map([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\n'],
      ['/chars/kfm/kfm.cns', '[StateDef 51]\ntype = A\nmovetype = I\nphysics = A\nanim = 51\nctrl = 0\n'],
      ['/chars/kfm/kfm.air', 'Begin Action 51\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', `
[Command]
name = "jumpdown"
command = /D

[Statedef -1]

[State -1, Jump Down]
type = ChangeState
triggerall = command = "jumpdown"
trigger1 = statetype = A
value = 51
`],
      ['/chars/common.cmd', ''],
      ['/chars/common1.cns', ''],
    ])));
    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 50, animNo: 50, stateType: 'A', physics: 'A', ctrl: false },
          state.players[1],
        ],
      },
      character.cns,
      {
        p1Commands: new Set(['jumpdown', 'holddown', 'down']),
        p2Commands: new Set(),
      },
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 51,
      animNo: 51,
      stateType: 'A',
      physics: 'A',
      ctrl: false,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('runs common walk glue before a character attack route replaces the walk State', async () => {
    const character = await loadCharacterFromDef('/chars/test/test.def', createFetcher(new Map([
      ['/chars/test/test.def', '[Files]\ncmd = test.cmd\ncns = test.cns\nanim = test.air\n'],
      ['/chars/test/test.cns', `
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[StateDef 21]
type = S
movetype = I
physics = S
anim = 21
ctrl = 1

[StateDef 205]
type = S
movetype = A
physics = S
anim = 205
ctrl = 0
`],
      ['/chars/test/test.air', 'Begin Action 0\n0,0, 0,0, 5\nBegin Action 21\n0,0, 0,0, 5\nBegin Action 205\n0,0, 0,0, 5\n'],
      ['/chars/test/test.cmd', `
[Command]
name = "x"
command = x

[Statedef -1]

[State -1, Attack]
type = ChangeState
triggerall = command = "x"
trigger1 = statetype = S
trigger1 = ctrl
value = 205
`],
      ['/chars/common.cmd', `
[Command]
name = "holdback"
command = /B

[Statedef -1]

[State -1, Common Walk Back]
type = ChangeState
triggerall = command = "holdback"
trigger1 = statetype = S
trigger1 = ctrl
trigger1 = stateno != 21
value = 21

[State -1, Common Walk Back Velocity]
type = VelSet
triggerall = command = "holdback"
trigger1 = stateno = 21
x = -2.2

[State -1, Common Walk Back Anim]
type = ChangeAnim
triggerall = command = "holdback"
trigger1 = stateno = 21
trigger1 = anim != 21
value = 21
`],
      ['/chars/common1.cns', ''],
    ])));

    const commandState = character.cns.states.find((state) => state.stateNo === -1);
    expect(commandState?.controllers.map((controller) => controller.type)).toEqual([
      'ChangeState',
      'VelSet',
      'ChangeAnim',
      'ChangeState',
    ]);

    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [{
        ...initial.players[0],
        stateNo: 21,
        animNo: 0,
        stateTime: 1,
        animTime: 1,
        ctrl: true,
      }, initial.players[1]],
    }, character.cns, {
      p1Commands: new Set(['holdback', 'x']),
      p2Commands: new Set(),
    });

    expect(result.state.players[0]).toMatchObject({
      prevStateNo: 21,
      stateNo: 205,
      animNo: 205,
      animTime: 0,
      moveType: 'A',
      ctrl: false,
    });
    expect(result.traces[0].executedControllers).toEqual([
      'VelSet',
      'ChangeState',
    ]);
  });
});

function createFetcher(textAssets: Map<string, string>): CharacterAssetFetcher {
  return {
    async text(path) {
      const asset = textAssets.get(path);
      if (asset === undefined) throw new Error(`missing text asset: ${path}`);
      return asset;
    },
    async arrayBuffer() {
      throw new Error('binary assets should not be loaded');
    },
  };
}
