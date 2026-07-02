import { describe, expect, it } from 'vitest';
import { loadCharacterFromDef, resolveAssetPath, type CharacterAssetFetcher } from './CharacterLoader';

describe('CharacterLoader', () => {
  it('resolves relative asset paths from def path', () => {
    expect(resolveAssetPath('/chars/kfm', 'kfm.air')).toBe('/chars/kfm.air'.replace('/kfm.air', '/kfm/kfm.air'));
    expect(resolveAssetPath('/chars/kfm/', './kfm.air')).toBe('/chars/kfm/kfm.air');
    expect(resolveAssetPath('/chars/kfm', '/global/kfm.air')).toBe('/global/kfm.air');
  });

  it('loads def, cns, air, cmd, and embedded common command fallback', async () => {
    const textAssets = new Map<string, string>([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\n'],
      ['/chars/kfm/kfm.cns', '[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n'],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', '[Command]\nname = "a"\ncommand = a\ntime = 1\n\n[Statedef -1]\n\n[State -1, A]\ntype = ChangeState\ntriggerall = command = "a"\ntrigger1 = ctrl\nvalue = 200\n'],
    ]);

    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createTextOnlyFetcher(textAssets));

    expect(character.cns.states.map((state) => state.stateNo)).toEqual([0, -1]);
    expect(character.air.actions[0].actionNo).toBe(0);
    expect(character.cmd.commands.map((command) => command.name)).toContain('a');
    expect(character.cmd.commands.map((command) => command.name)).toContain('holddown');
    expect(character.sprites).toBeNull();
    expect(character.palettes).toEqual([]);
  });

  it('loads common1 CNS states only when character CNS is missing them', async () => {
    const textAssets = new Map<string, string>([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\n'],
      ['/chars/kfm/kfm.cns', '[StateDef 200]\ntype = S\nmovetype = A\nphysics = S\nanim = 200\nctrl = 0\n'],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', '[Command]\nname = "x"\ncommand = x\ntime = 1\n\n[Statedef -1]\n\n[State -1, X]\ntype = ChangeState\ntriggerall = command = "x"\ntrigger1 = ctrl\nvalue = 200\n'],
      ['/chars/common1.cns', '[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n\n[StateDef 200]\ntype = S\nmovetype = I\nphysics = S\nanim = 999\nctrl = 1\n'],
    ]);

    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createTextOnlyFetcher(textAssets));

    expect(character.cns.states.map((state) => state.stateNo)).toEqual([200, -1, 0]);
    expect(character.cns.states.find((state) => state.stateNo === 200)?.initialAnim).toBe(200);
    expect(character.cns.states.find((state) => state.stateNo === 0)?.initialAnim).toBe(0);
  });

  it('merges common1 command state controllers into character command state', async () => {
    const textAssets = new Map<string, string>([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\n'],
      ['/chars/kfm/kfm.cns', '[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n'],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', '[Command]\nname = "a"\ncommand = a\n\n[Statedef -1]\n\n[State -1, A]\ntype = ChangeState\ntriggerall = command = "a"\ntrigger1 = ctrl\nvalue = 200\n'],
      ['/chars/common1.cns', '[Statedef -1]\n\n[State -1, Jump]\ntype = ChangeState\ntriggerall = command = "holdup"\ntrigger1 = ctrl\nvalue = 40\n\n[StateDef 40]\ntype = A\nmovetype = I\nphysics = A\nanim = 40\nctrl = 0\n'],
    ]);

    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createTextOnlyFetcher(textAssets));
    const commandState = character.cns.states.find((state) => state.stateNo === -1);

    expect(character.cns.states.map((state) => state.stateNo)).toEqual([0, -1, 40]);
    expect(commandState?.controllers.map((controller) => controller.params.value)).toEqual([10, 11, 12, 20, 21, 40, 200, 0]);
  });

  it('loads common CMD command definitions and Statedef -1 routing', async () => {
    const textAssets = new Map<string, string>([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\n'],
      ['/chars/kfm/kfm.cns', '[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n'],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', '[Command]\nname = "a"\ncommand = a\n\n[Statedef -1]\n\n[State -1, A]\ntype = ChangeState\ntriggerall = command = "a"\ntrigger1 = ctrl\nvalue = 200\n'],
      ['/chars/common.cmd', '[Command]\nname = "holdup"\ncommand = /U\n\n[Statedef -1]\n\n[State -1, Common Jump]\ntype = ChangeState\ntriggerall = command = "holdup"\ntrigger1 = statetype = S\ntrigger1 = ctrl\nvalue = 40\n'],
      ['/chars/common1.cns', '[StateDef 40]\ntype = A\nmovetype = I\nphysics = A\nanim = 40\nctrl = 0\n'],
    ]);

    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createTextOnlyFetcher(textAssets));
    const commandState = character.cns.states.find((state) => state.stateNo === -1);

    expect(character.cmd.commands.map((command) => command.name)).toContain('holdup');
    expect(character.cns.states.map((state) => state.stateNo)).toEqual([0, -1, 40]);
    expect(commandState?.controllers.map((controller) => controller.params.value)).toEqual([40, 200]);
  });

  it('prefers character command routes over common command routes', async () => {
    const textAssets = new Map<string, string>([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\n'],
      ['/chars/kfm/kfm.cns', '[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n\n[StateDef 41]\ntype = A\nmovetype = I\nphysics = A\nanim = 41\nctrl = 0\n'],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', '[Command]\nname = "holdup"\ncommand = /U\n\n[Statedef -1]\n\n[State -1, Character Jump]\ntype = ChangeState\ntriggerall = command = "holdup"\ntrigger1 = ctrl\nvalue = 41\n'],
      ['/chars/common.cmd', '[Command]\nname = "holdup"\ncommand = /U\n\n[Statedef -1]\n\n[State -1, Common Jump]\ntype = ChangeState\ntriggerall = command = "holdup"\ntrigger1 = ctrl\nvalue = 40\n'],
      ['/chars/common1.cns', '[StateDef 40]\ntype = A\nmovetype = I\nphysics = A\nanim = 40\nctrl = 0\n'],
    ]);

    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createTextOnlyFetcher(textAssets));
    const commandState = character.cns.states.find((state) => state.stateNo === -1);

    expect(commandState?.controllers.map((controller) => controller.params.value)).toEqual([41]);
  });

  it('keeps common crouch route when character defines crouching attacks', async () => {
    const textAssets = new Map<string, string>([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\n'],
      ['/chars/kfm/kfm.cns', '[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n\n[StateDef 10]\ntype = C\nmovetype = I\nphysics = C\nanim = 10\nctrl = 0\n\n[StateDef 400]\ntype = C\nmovetype = A\nphysics = C\nanim = 400\nctrl = 0\n'],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', '[Command]\nname = "a"\ncommand = a\n\n[Statedef -1]\n\n[State -1, Crouch Attack]\ntype = ChangeState\ntriggerall = command = "a"\ntriggerall = command = "holddown"\ntrigger1 = ctrl\nvalue = 400\n'],
      ['/chars/common.cmd', '[Command]\nname = "holddown"\ncommand = /D\n\n[Statedef -1]\n\n[State -1, Common Crouch Start]\ntype = ChangeState\ntriggerall = command = "holddown"\ntrigger1 = statetype = S\ntrigger1 = ctrl\nvalue = 10\n'],
      ['/chars/common1.cns', '[StateDef 10]\ntype = C\nmovetype = I\nphysics = C\nanim = 10\nctrl = 0\n'],
    ]);

    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', createTextOnlyFetcher(textAssets));
    const commandState = character.cns.states.find((state) => state.stateNo === -1);

    expect(commandState?.controllers.map((controller) => controller.params.value)).toEqual([10, 400]);
  });

  it('loads ACT palette assets declared by DEF pal entries', async () => {
    const paletteBytes = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const textAssets = new Map<string, string>([
      ['/chars/kfm/kfm.def', '[Files]\ncmd = kfm.cmd\ncns = kfm.cns\nanim = kfm.air\npal2 = kfm4.act\npal1 = kfm6.act\n'],
      ['/chars/kfm/kfm.cns', '[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n'],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', '[Command]\nname = "a"\ncommand = a\ntime = 1\n'],
    ]);
    const binaryAssets = new Map<string, ArrayBuffer>([
      ['/chars/kfm/kfm6.act', toArrayBuffer(paletteBytes)],
      ['/chars/kfm/kfm4.act', toArrayBuffer(new Uint8Array([7, 8, 9]))],
    ]);
    const fetcher = createTextOnlyFetcher(textAssets, binaryAssets);

    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', fetcher);

    expect(character.palettes.map((palette) => ({ slot: palette.slot, file: palette.file }))).toEqual([
      { slot: 1, file: 'kfm6.act' },
      { slot: 2, file: 'kfm4.act' },
    ]);
    expect(Array.from(character.palettes[0].bytes)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

function createTextOnlyFetcher(
  textAssets: Map<string, string>,
  binaryAssets = new Map<string, ArrayBuffer>(),
): CharacterAssetFetcher {
  return {
    async text(path) {
      const asset = textAssets.get(path);
      if (asset === undefined) {
        throw new Error(`missing text asset: ${path}`);
      }
      return asset;
    },
    async arrayBuffer(path) {
      const asset = binaryAssets.get(path);
      if (asset === undefined) {
        throw new Error(`missing binary asset: ${path}`);
      }
      return asset;
    },
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}
