import { describe, expect, it } from 'vitest';
import { loadCharacterFromDef, resolveAssetPath, type CharacterAssetFetcher } from './CharacterLoader';

describe('CharacterLoader', () => {
  it('resolves relative asset paths from def path', () => {
    expect(resolveAssetPath('/chars/kfm', 'kfm.air')).toBe('/chars/kfm/kfm.air');
    expect(resolveAssetPath('/chars/kfm/', './kfm.air')).toBe('/chars/kfm/kfm.air');
    expect(resolveAssetPath('/chars/kfm', '/global/kfm.air')).toBe('/global/kfm.air');
  });

  it('loads def, cns, air, cmd, and CMD statedef assets', async () => {
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
      [
        '/chars/kfm/kfm.cns',
        `
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1
`,
      ],
      [
        '/chars/kfm/kfm.air',
        `
Begin Action 0
0,0, 0,0, 5
`,
      ],
      [
        '/chars/kfm/kfm.cmd',
        `
[Command]
name = "a"
command = a
time = 1

[Statedef -1]

[State -1, A]
type = ChangeState
triggerall = command = "a"
trigger1 = ctrl
value = 200
`,
      ],
    ]);

    const fetcher: CharacterAssetFetcher = {
      async text(path) {
        const asset = textAssets.get(path);
        if (asset === undefined) {
          throw new Error(`missing text asset: ${path}`);
        }
        return asset;
      },
      async arrayBuffer() {
        throw new Error('sff should not be loaded in this test');
      },
    };

    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', fetcher);

    expect(character.cns.states.map((state) => state.stateNo)).toEqual([0, -1]);
    expect(character.air.actions[0].actionNo).toBe(0);
    expect(character.cmd.commands[0].name).toBe('a');
    expect(character.sprites).toBeNull();
    expect(character.palettes).toEqual([]);
  });

  it('loads common1 CNS states only when character CNS is missing them', async () => {
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
      [
        '/chars/kfm/kfm.cns',
        `
[StateDef 200]
type = S
movetype = A
physics = S
anim = 200
ctrl = 0
`,
      ],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      [
        '/chars/kfm/kfm.cmd',
        `
[Command]
name = "x"
command = x
time = 1

[Statedef -1]

[State -1, X]
type = ChangeState
triggerall = command = "x"
trigger1 = ctrl
value = 200
`,
      ],
      [
        '/chars/common1.cns',
        `
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[StateDef 200]
type = S
movetype = I
physics = S
anim = 999
ctrl = 1
`,
      ],
    ]);

    const fetcher: CharacterAssetFetcher = {
      async text(path) {
        const asset = textAssets.get(path);
        if (asset === undefined) {
          throw new Error(`missing text asset: ${path}`);
        }
        return asset;
      },
      async arrayBuffer() {
        throw new Error('sff should not be loaded in this test');
      },
    };

    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', fetcher);

    expect(character.cns.states.map((state) => state.stateNo)).toEqual([200, -1, 0]);
    expect(character.cns.states.find((state) => state.stateNo === 200)?.initialAnim).toBe(200);
    expect(character.cns.states.find((state) => state.stateNo === 0)?.initialAnim).toBe(0);
  });

  it('merges common1 command state controllers into character command state', async () => {
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
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      [
        '/chars/kfm/kfm.cmd',
        `
[Command]
name = "a"
command = a

[Statedef -1]

[State -1, A]
type = ChangeState
triggerall = command = "a"
trigger1 = ctrl
value = 200
`,
      ],
      [
        '/chars/common1.cns',
        `
[Statedef -1]

[State -1, Jump]
type = ChangeState
triggerall = command = "holdup"
trigger1 = ctrl
value = 40

[StateDef 40]
type = A
movetype = I
physics = A
anim = 40
ctrl = 0
`,
      ],
    ]);

    const fetcher: CharacterAssetFetcher = {
      async text(path) {
        const asset = textAssets.get(path);
        if (asset === undefined) {
          throw new Error(`missing text asset: ${path}`);
        }
        return asset;
      },
      async arrayBuffer() {
        throw new Error('sff should not be loaded in this test');
      },
    };

    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', fetcher);
    const commandState = character.cns.states.find((state) => state.stateNo === -1);

    expect(character.cns.states.map((state) => state.stateNo)).toEqual([0, -1, 40]);
    expect(commandState?.controllers.map((controller) => controller.params.value)).toEqual([200, 40]);
  });

  it('loads ACT palette assets declared by DEF pal entries', async () => {
    const paletteBytes = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const textAssets = new Map<string, string>([
      [
        '/chars/kfm/kfm.def',
        `
[Files]
cmd = kfm.cmd
cns = kfm.cns
anim = kfm.air
pal2 = kfm4.act
pal1 = kfm6.act
`,
      ],
      ['/chars/kfm/kfm.cns', '[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n'],
      ['/chars/kfm/kfm.air', 'Begin Action 0\n0,0, 0,0, 5\n'],
      ['/chars/kfm/kfm.cmd', '[Command]\nname = "a"\ncommand = a\ntime = 1\n'],
    ]);

    const binaryAssets = new Map<string, ArrayBuffer>([
      ['/chars/kfm/kfm6.act', toArrayBuffer(paletteBytes)],
      ['/chars/kfm/kfm4.act', toArrayBuffer(new Uint8Array([7, 8, 9]))],
    ]);

    const fetcher: CharacterAssetFetcher = {
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

    const character = await loadCharacterFromDef('/chars/kfm/kfm.def', fetcher);

    expect(character.palettes.map((palette) => ({ slot: palette.slot, file: palette.file }))).toEqual([
      { slot: 1, file: 'kfm6.act' },
      { slot: 2, file: 'kfm4.act' },
    ]);
    expect(Array.from(character.palettes[0].bytes)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}
