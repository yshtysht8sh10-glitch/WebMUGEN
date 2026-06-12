import { describe, expect, it } from 'vitest';
import { loadCharacterFromDef, resolveAssetPath, type CharacterAssetFetcher } from './CharacterLoader';

describe('CharacterLoader', () => {
  it('resolves relative asset paths from def path', () => {
    expect(resolveAssetPath('/chars/kfm', 'kfm.air')).toBe('/chars/kfm/kfm.air');
    expect(resolveAssetPath('/chars/kfm/', './kfm.air')).toBe('/chars/kfm/kfm.air');
    expect(resolveAssetPath('/chars/kfm', '/global/kfm.air')).toBe('/global/kfm.air');
  });

  it('loads def, cns, air, and cmd assets', async () => {
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

    expect(character.cns.states[0].stateNo).toBe(0);
    expect(character.air.actions[0].actionNo).toBe(0);
    expect(character.cmd.commands[0].name).toBe('a');
    expect(character.sprites).toBeNull();
  });
});
