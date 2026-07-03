import { describe, expect, it } from 'vitest';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { loadCharacterFromDef, type CharacterAssetFetcher } from './CharacterLoader';

function createCommonRouteTestFetcher(): CharacterAssetFetcher {
  const textAssets = new Map<string, string>([
    [
      '/chars/kfm/kfm.def',
      `
[Files]
cmd = kfm.cmd
cns = kfm.cns
anim = kfm.air
`,
    ],
    ['/chars/kfm/kfm.cns', '[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n'],
    ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\nBegin Action 10\n0,0, 0,0, 5\nBegin Action 11\n0,0, 0,0, 5\nBegin Action 12\n0,0, 0,0, 5\nBegin Action 20\n0,0, 0,0, 5\nBegin Action 40\n0,0, 0,0, 5\n'],
    [
      '/chars/kfm/kfm.cmd',
      `
[Command]
name = "y"
command = y

[Command]
name = "holdfwd"
command = /$F

[Command]
name = "holdback"
command = /$B

[Command]
name = "holddown"
command = /$D

[Statedef -1]

[State -1, Throw]
type = ChangeState
triggerall = command = "y"
triggerall = statetype = S
triggerall = ctrl
trigger1 = command = "holdfwd"
value = 800
`,
    ],
    [
      '/chars/common.cmd',
      `
[Command]
name = "holdfwd"
command = /F

[Command]
name = "holdback"
command = /B

[Command]
name = "holddown"
command = /D

[Command]
name = "holdup"
command = /U

[Statedef -1]

[State -1, Common Jump]
type = ChangeState
triggerall = command = "holdup"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 40

[State -1, Common Crouch Start]
type = ChangeState
triggerall = command = "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 10

[State -1, Common Walk Forward]
type = ChangeState
triggerall = command = "holdfwd"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
trigger1 = stateno != 20
value = 20

[State -1, Common Walk Back]
type = ChangeState
triggerall = command = "holdback"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 21

[State -1, Common Walk Stop]
type = ChangeState
triggerall = command != "holdfwd"
triggerall = command != "holdback"
triggerall = command != "holddown"
trigger1 = stateno = 20
trigger2 = stateno = 21
value = 0
`,
    ],
    ['/chars/common1.cns', '[StateDef 10]\ntype = C\nmovetype = I\nphysics = C\nanim = 10\nctrl = 0\n\n[State 10, Hold]\ntype = ChangeState\ntrigger1 = command = "holddown"\nvalue = 11\n\n[StateDef 11]\ntype = C\nmovetype = I\nphysics = C\nanim = 11\nctrl = 1\n\n[State 11, Release]\ntype = ChangeState\ntrigger1 = command != "holddown"\nvalue = 12\n\n[StateDef 12]\ntype = S\nmovetype = I\nphysics = S\nanim = 12\nctrl = 0\n\n[StateDef 20]\ntype = S\nmovetype = I\nphysics = S\nanim = 20\nctrl = 1\n\n[StateDef 21]\ntype = S\nmovetype = I\nphysics = S\nanim = 20\nctrl = 1\n\n[StateDef 40]\ntype = S\nmovetype = I\nphysics = S\nanim = 40\nctrl = 0\n'],
  ]);

  return {
    async text(path) {
      const asset = textAssets.get(path);
      if (asset === undefined) throw new Error(`missing text asset: ${path}`);
      return asset;
    },
    async arrayBuffer() {
      throw new Error('binary assets are not used in this test');
    },
  };
}

describe('CharacterLoader common movement routes', () => {
  it('keeps common holdfwd movement before character routes when holdfwd is only a modifier', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createCommonRouteTestFetcher());
    const commandState = character.cns.states.find((state) => state.stateNo === -1);

    expect(commandState?.controllers.map((controller) => controller.params.value)).toEqual([40, 10, 20, 21, 800, 0]);
  });

  it('runs common holdfwd route into State 20 at runtime', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createCommonRouteTestFetcher());
    const result = stepCnsStateRuntime(createInitialGameState(), character.cns, {
      p1Commands: new Set(['holdfwd']),
      p2Commands: new Set(),
    });

    expect(result.state.players[0].stateNo).toBe(20);
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('runs common holddown route through State 10 startup into crouching State 11 at runtime', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createCommonRouteTestFetcher());
    const result = stepCnsStateRuntime(createInitialGameState(), character.cns, {
      p1Commands: new Set(['holddown', 'down']),
      p2Commands: new Set(),
    });

    expect(result.state.players[0]).toMatchObject({
      stateNo: 11,
      animNo: 11,
      stateType: 'C',
      physics: 'C',
      ctrl: true,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('runs common holdback route into State 21 at runtime', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createCommonRouteTestFetcher());
    const result = stepCnsStateRuntime(createInitialGameState(), character.cns, {
      p1Commands: new Set(['holdback']),
      p2Commands: new Set(),
    });

    expect(result.state.players[0]).toMatchObject({
      stateNo: 21,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('returns from State 20 to stand when holdfwd is released', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createCommonRouteTestFetcher());
    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 20, animNo: 20, stateType: 'S', physics: 'S', ctrl: true },
          state.players[1],
        ],
      },
      character.cns,
      {
        p1Commands: new Set(),
        p2Commands: new Set(),
      },
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 0,
      animNo: 0,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('runs common holdup route from State 20 into State 40', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createCommonRouteTestFetcher());
    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 20, animNo: 20, stateType: 'S', physics: 'S', ctrl: true },
          state.players[1],
        ],
      },
      character.cns,
      {
        p1Commands: new Set(['holdup', 'up', 'holdfwd']),
        p2Commands: new Set(),
      },
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 40,
      animNo: 40,
      stateType: 'S',
      physics: 'S',
      ctrl: false,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('runs common crouch hold route from State 10 into State 11', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createCommonRouteTestFetcher());
    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 10, animNo: 10, stateType: 'C', physics: 'C', ctrl: false },
          state.players[1],
        ],
      },
      character.cns,
      {
        p1Commands: new Set(['holddown', 'down']),
        p2Commands: new Set(),
      },
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 11,
      animNo: 11,
      stateType: 'C',
      physics: 'C',
      ctrl: true,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('runs common crouch release route from State 11 into State 12', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createCommonRouteTestFetcher());
    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 11, animNo: 11, stateType: 'C', physics: 'C', ctrl: true },
          state.players[1],
        ],
      },
      character.cns,
      {
        p1Commands: new Set(),
        p2Commands: new Set(),
      },
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 12,
      animNo: 12,
      stateType: 'S',
      physics: 'S',
      ctrl: false,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });
});
