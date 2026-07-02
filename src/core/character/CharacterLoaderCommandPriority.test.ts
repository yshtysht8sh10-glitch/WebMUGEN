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
