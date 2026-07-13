import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { readFile } from 'node:fs/promises';
import { getAnimationDuration } from '../core/animation/AnimationDuration';
import { stepCnsStateRuntime } from '../core/cns/CnsStateRuntime';
import { analyzeCnsCoverage } from '../core/cns/CnsCoverageDiagnostics';
import { createInitialGameState } from '../core/engine/GameState';
import { formatScenarioFrame, holdP1Keys, neutral, simulateCnsInputScenario } from '../testing/CnsInputScenarioSimulator';
import { createSampleCharacterAssets, loadAppCharacter } from './AppCharacterLoader';

class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

(globalThis as unknown as { ImageData: typeof ImageData }).ImageData =
  FakeImageData as unknown as typeof ImageData;

describe('AppCharacterLoader', () => {
  it('creates sample character assets', () => {
    const assets = createSampleCharacterAssets();

    expect(assets.cns.states.length).toBeGreaterThan(0);
    expect(assets.air.actions.length).toBeGreaterThan(0);
    expect(assets.cmd.commands.length).toBeGreaterThan(0);
    expect(assets.sprites).toBeNull();
  });

  it('loads a character from a zip archive', async () => {
    const sndBytes = makeSingleSampleSnd(4, 2, new Uint8Array([82, 73, 70, 70, 1, 0, 0, 0, 87, 65, 86, 69]));
    const zipBytes = zipSync({
      'Demo/Demo.def': strToU8('[Files]\ncmd = Demo.cmd\ncns = Demo.cns\nanim = Demo.air\nsound = audio/Demo.snd\n'),
      'Demo/Demo.cns': strToU8('[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n'),
      'Demo/Demo.air': strToU8('Begin Action 0\n0,0, 0,0, 5\n'),
      'Demo/Demo.cmd': strToU8('[Command]\nname = "a"\ncommand = a\ntime = 1\n'),
      'Demo/audio/Demo.snd': sndBytes,
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
      expect(result.character?.sounds?.samplesByKey.get('4,2')?.bytes).toEqual(sndBytes.slice(528));
      expect(result.character?.cnsSourceFiles?.map((file) => file.path)).toEqual(expect.arrayContaining([
        'Demo/Demo.def',
        'Demo/Demo.cns',
        'Demo/Demo.cmd',
        'Demo/Demo.air',
        '/chars/common.cmd',
      ]));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('loads the bundled T-H-M-A zip without falling back to the sample character', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: RequestInfo | URL) => {
      const url = String(path);
      if (url === '/chars/T-H-M-A.zip') {
        return new Response(await readFile('public/chars/T-H-M-A.zip'), { status: 200 });
      }
      if (url === '/chars/common.cmd') {
        return new Response(await readFile('public/chars/common.cmd', 'utf8'), { status: 200 });
      }
      if (url === '/chars/common1.cns') {
        return new Response(await readFile('public/chars/common1.cns', 'utf8'), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    }) as typeof fetch;

    try {
      const result = await loadAppCharacter('/chars/T-H-M-A.zip');

      expect(result.source).toBe('def');
      expect(result.errorMessage).toBeNull();
      expect(result.character?.cns.states.length).toBeGreaterThan(9);
      expect(result.character?.cmd.commands.length).toBeGreaterThan(8);
      expect(result.character?.sprites?.sprites.size ?? 0).toBeGreaterThan(0);
      expect(result.character?.sounds?.samples.length ?? 0).toBeGreaterThan(0);
      expect(result.character?.sounds?.samples.some((sample) => sample.format === 'wave')).toBe(true);
      expect(result.character?.loadDiagnostics).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('classifies bundled T-H-M-A CNS controllers and triggers without unsupported diagnostics', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: RequestInfo | URL) => {
      const url = String(path);
      if (url === '/chars/T-H-M-A.zip') {
        return new Response(await readFile('public/chars/T-H-M-A.zip'), { status: 200 });
      }
      if (url === '/chars/common.cmd') {
        return new Response(await readFile('public/chars/common.cmd', 'utf8'), { status: 200 });
      }
      if (url === '/chars/common1.cns') {
        return new Response(await readFile('public/chars/common1.cns', 'utf8'), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    }) as typeof fetch;

    try {
      const result = await loadAppCharacter('/chars/T-H-M-A.zip');
      expect(result.character).not.toBeNull();

      const diagnostics = analyzeCnsCoverage(result.character!.cns);
      expect(diagnostics.unsupportedControllers).toEqual([]);
      expect(diagnostics.unsupportedTriggers).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('applies T-H-M-A jump startup velocity instead of sticking in air state at ground level', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: RequestInfo | URL) => {
      const url = String(path);
      if (url === '/chars/T-H-M-A.zip') {
        return new Response(await readFile('public/chars/T-H-M-A.zip'), { status: 200 });
      }
      if (url === '/chars/common.cmd') {
        return new Response(await readFile('public/chars/common.cmd', 'utf8'), { status: 200 });
      }
      if (url === '/chars/common1.cns') {
        return new Response(await readFile('public/chars/common1.cns', 'utf8'), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    }) as typeof fetch;

    try {
      const result = await loadAppCharacter('/chars/T-H-M-A.zip');
      const character = result.character;
      expect(character).not.toBeNull();

      const state = createInitialGameState();
      const jumpStartupDuration = getAnimationDuration(character!.air, 40) ?? 0;
      const runtimeResult = stepCnsStateRuntime(
        {
          ...state,
          players: [
            {
              ...state.players[0],
              stateNo: 40,
              animNo: 40,
              animTime: jumpStartupDuration,
              stateTime: 0,
              ctrl: false,
            },
            state.players[1],
          ],
        },
        character!.cns,
        {
          p1Commands: new Set(['holdup', 'up']),
          p2Commands: new Set(),
          getAnimationDuration: (animNo) => getAnimationDuration(character!.air, animNo),
        },
      );

      expect(runtimeResult.state.players[0]).toMatchObject({
        stateNo: 50,
        prevStateNo: 40,
        ctrl: true,
      });
      expect(runtimeResult.state.players[0].vy).toBeLessThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('routes T-H-M-A jump from idle through state 40 into controllable air state 50', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: RequestInfo | URL) => {
      const url = String(path);
      if (url === '/chars/T-H-M-A.zip') {
        return new Response(await readFile('public/chars/T-H-M-A.zip'), { status: 200 });
      }
      if (url === '/chars/common.cmd') {
        return new Response(await readFile('public/chars/common.cmd', 'utf8'), { status: 200 });
      }
      if (url === '/chars/common1.cns') {
        return new Response(await readFile('public/chars/common1.cns', 'utf8'), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    }) as typeof fetch;

    try {
      const result = await loadAppCharacter('/chars/T-H-M-A.zip');
      const character = result.character;
      expect(character).not.toBeNull();

      const simulation = simulateCnsInputScenario(character!, [
        holdP1Keys(['ArrowUp'], 1),
        neutral(7),
      ]);
      const finalFrame = simulation.frames[simulation.frames.length - 1];
      expect(finalFrame, simulation.frames.map(formatScenarioFrame).join('\n')).toBeDefined();

      expect(finalFrame!.p1).toMatchObject({
        stateNo: 50,
        prevStateNo: 40,
        ctrl: true,
      });
      expect(finalFrame!.p1.vy).toBeLessThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns T-H-M-A from jump landing to idle state 0', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: RequestInfo | URL) => {
      const url = String(path);
      if (url === '/chars/T-H-M-A.zip') {
        return new Response(await readFile('public/chars/T-H-M-A.zip'), { status: 200 });
      }
      if (url === '/chars/common.cmd') {
        return new Response(await readFile('public/chars/common.cmd', 'utf8'), { status: 200 });
      }
      if (url === '/chars/common1.cns') {
        return new Response(await readFile('public/chars/common1.cns', 'utf8'), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    }) as typeof fetch;

    try {
      const result = await loadAppCharacter('/chars/T-H-M-A.zip');
      const character = result.character;
      expect(character).not.toBeNull();

      const simulation = simulateCnsInputScenario(character!, [
        holdP1Keys(['ArrowUp'], 1),
        neutral(170),
      ]);
      const history = simulation.frames.map(formatScenarioFrame).join('\n');

      expect(simulation.frames.some((frame) => frame.p1.stateNo === 50), history).toBe(true);
      expect(simulation.frames.some((frame) => frame.p1.stateNo === 52), history).toBe(true);

      const finalFrame = simulation.frames[simulation.frames.length - 1];
      expect(finalFrame, history).toBeDefined();
      expect(finalFrame!.p1).toMatchObject({
        stateNo: 0,
        stateType: 'S',
        physics: 'S',
        animNo: 0,
        ctrl: true,
        y: 285,
        vy: 0,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 10000);

  it('routes T-H-M-A crouch from idle through states 10 and 11, then back to stand on release', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: RequestInfo | URL) => {
      const url = String(path);
      if (url === '/chars/T-H-M-A.zip') {
        return new Response(await readFile('public/chars/T-H-M-A.zip'), { status: 200 });
      }
      if (url === '/chars/common.cmd') {
        return new Response(await readFile('public/chars/common.cmd', 'utf8'), { status: 200 });
      }
      if (url === '/chars/common1.cns') {
        return new Response(await readFile('public/chars/common1.cns', 'utf8'), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    }) as typeof fetch;

    try {
      const result = await loadAppCharacter('/chars/T-H-M-A.zip');
      const character = result.character;
      expect(character).not.toBeNull();

      const simulation = simulateCnsInputScenario(character!, [
        holdP1Keys(['ArrowDown'], 12),
        neutral(12),
      ]);
      const history = simulation.frames.map(formatScenarioFrame).join('\n');

      expect(simulation.frames.some((frame) => frame.p1.stateNo === 10 && frame.p1.animNo === 10), history).toBe(true);
      expect(simulation.frames.some((frame) => frame.p1.stateNo === 11 && frame.p1.animNo === 11), history).toBe(true);
      expect(simulation.frames.some((frame) => frame.p1.stateNo === 12 && frame.p1.animNo === 12), history).toBe(true);

      const finalFrame = simulation.frames[simulation.frames.length - 1];
      expect(finalFrame, history).toBeDefined();
      expect(finalFrame!.p1).toMatchObject({
        stateNo: 0,
        stateType: 'S',
        animNo: 0,
        ctrl: true,
      });
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

function makeSingleSampleSnd(group: number, index: number, payload: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(512 + 16 + payload.byteLength);
  bytes.set(Array.from('ElecbyteSnd\0').map((value) => value.charCodeAt(0)), 0);
  bytes.set([1, 0, 0, 0], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 1, true);
  view.setUint32(20, 512, true);
  view.setUint32(516, payload.byteLength, true);
  view.setInt32(520, group, true);
  view.setInt32(524, index, true);
  bytes.set(payload, 528);
  return bytes;
}
