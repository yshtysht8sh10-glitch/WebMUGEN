import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { createSampleCharacterAssets, loadAppCharacter } from './AppCharacterLoader';

describe('AppCharacterLoader', () => {
  it('creates sample character assets', () => {
    const assets = createSampleCharacterAssets();

    expect(assets.cns.states.length).toBeGreaterThan(0);
    expect(assets.air.actions.length).toBeGreaterThan(0);
    expect(assets.cmd.commands.length).toBeGreaterThan(0);
    expect(assets.sprites).toBeNull();
  });

  it('loads a character from a zip archive', async () => {
    const zipBytes = zipSync({
      'Demo/Demo.def': strToU8('[Files]\ncmd = Demo.cmd\ncns = Demo.cns\nanim = Demo.air\n'),
      'Demo/Demo.cns': strToU8('[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n'),
      'Demo/Demo.air': strToU8('Begin Action 0\n0,0, 0,0, 5\n'),
      'Demo/Demo.cmd': strToU8('[Command]\nname = "a"\ncommand = a\ntime = 1\n'),
      'chars/common.cmd': strToU8('[Command]\nname = "holdup"\ncommand = /U\n'),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: RequestInfo | URL) => {
      const url = String(path);
      if (url === '/chars/Demo.zip') {
        return new Response(toArrayBuffer(zipBytes), { status: 200 });
      }
      if (url === '/chars/common.cmd') {
        return new Response('[Command]\nname = "holddown"\ncommand = /D\n', { status: 200 });
      }
      return new Response('missing', { status: 404 });
    }) as typeof fetch;

    try {
      const result = await loadAppCharacter('/chars/Demo.zip');

      expect(result.source).toBe('def');
      expect(result.character?.air.actions[0].actionNo).toBe(0);
      expect(result.character?.cmd.commands.map((command) => command.name)).toContain('a');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}
