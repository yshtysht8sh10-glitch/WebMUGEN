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
    ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\nBegin Action 20\n0,0, 0,0, 5\n'],
    [
      '/chars/kfm/kfm.cmd',
      `
[Command]
name = "y"
command = y

[Command]
name = "holdfwd"
command = /$F

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

[Statedef -1]

[State -1, Common Walk Forward]
type = ChangeState
triggerall = command = "holdfwd"
trigger1 = statetype = S
trigger1 = ctrl
value = 20
`,
    ],
    ['/chars/common1.cns', '[StateDef 20]\ntype = S\nmovetype = I\nphysics = S\nanim = 20\nctrl = 1\n'],
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
  it('keeps common holdfwd movement when character uses holdfwd only as a modifier', async () => {
    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createCommonRouteTestFetcher());
    const commandState = character.cns.states.find((state) => state.stateNo === -1);

    expect(commandState?.controllers.map((controller) => controller.params.value)).toEqual([800, 20]);
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
});
