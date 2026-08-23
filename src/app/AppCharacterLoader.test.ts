import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { readFile } from 'node:fs/promises';
import { getAnimationDuration } from '../core/animation/AnimationDuration';
import { stepCnsStateRuntime } from '../core/cns/CnsStateRuntime';
import { readCnsConst } from '../core/cns/CnsConstants';
import { stepCnsPhysicsMotion } from '../core/cns/CnsPhysicsStep';
import { readNumberExpression } from '../core/cns/CnsRuntimeTrigger';
import { analyzeCnsCoverage } from '../core/cns/CnsCoverageDiagnostics';
import { createInitialGameState } from '../core/engine/GameState';
import { formatScenarioFrame, holdP1Keys, neutral, simulateCnsInputScenario } from '../testing/CnsInputScenarioSimulator';
import { createSampleCharacterAssets, loadAppCharacter, readCharacterRuntimeMetadata, saveCharacterSourceFile } from './AppCharacterLoader';

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
      'Demo/Demo.def': strToU8('[Info]\nname = "Metadata Fighter"\nauthor = "Metadata Author"\n\n[Files]\ncmd = Demo.cmd\ncns = Demo.cns\nanim = Demo.air\nsound = audio/Demo.snd\npal3 = palettes/demo.act\n'),
      'Demo/Demo.cns': strToU8('[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n'),
      'Demo/Demo.air': strToU8('Begin Action 0\n0,0, 0,0, 5\n'),
      'Demo/Demo.cmd': strToU8('[Command]\nname = "a"\ncommand = a\ntime = 1\n'),
      'Demo/audio/Demo.snd': sndBytes,
      'Demo/palettes/demo.act': new Uint8Array(768),
      'Demo/readme.txt': strToU8('ordinary character notes'),
      'Demo/states/demo.zss': strToU8('StateDef 100 {}'),
      'Demo/preview.sff': new Uint8Array([0, 1, 2, 3]),
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
      expect(readCharacterRuntimeMetadata(result.character!)).toEqual({
        name: 'Metadata Fighter', authorName: 'Metadata Author', palNo: 3,
      });
      expect(readCharacterRuntimeMetadata(result.character!, 9).palNo).toBe(9);
      expect(result.character?.cnsSourceFiles?.map((file) => file.path)).toEqual(expect.arrayContaining([
        'Demo/Demo.def',
        'Demo/Demo.cns',
        'Demo/Demo.cmd',
        'Demo/Demo.air',
        'Demo/readme.txt',
        'Demo/states/demo.zss',
        'Demo/preview.sff',
        'Demo/audio/Demo.snd',
        'Demo/palettes/demo.act',
        '/chars/common.cmd',
      ]));
      expect(result.character?.cnsSourceFiles?.find((file) => file.path === 'Demo/readme.txt')).toMatchObject({
        kind: 'text', text: 'ordinary character notes', editable: true, external: false,
      });
      expect(result.character?.cnsSourceFiles?.find((file) => file.path === 'Demo/states/demo.zss')).toMatchObject({
        kind: 'zss', label: 'states/demo.zss', editable: true, external: false,
      });
      expect(result.character?.cnsSourceFiles?.find((file) => file.path === 'Demo/preview.sff')).toMatchObject({
        kind: 'sff', editable: false, external: false,
      });
      expect(result.character?.cnsSourceFiles?.find((file) => file.path === 'Demo/palettes/demo.act')).toMatchObject({
        kind: 'act', editable: false, external: false, binary: expect.any(Uint8Array),
      });
      expect(result.character?.cnsSourceFiles?.find((file) => file.path === 'Demo/audio/Demo.snd')).toMatchObject({
        kind: 'snd', label: 'audio/Demo.snd', editable: false, external: false, binary: expect.any(Uint8Array),
      });
      expect(result.character?.cnsSourceFiles?.find((file) => file.path === '/chars/common.cmd')).toMatchObject({
        kind: 'common', external: true, archivePath: '/chars/Demo.zip', archiveEntryPath: 'chars/common.cmd',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('discovers a nested Character DEF by structure and resolves its files from the DEF directory', async () => {
    const zipBytes = zipSync({
      'package/stage.def': strToU8('[Info]\nname = Arena\n[Camera]\n[PlayerInfo]\n[Bound]\n[BGDef]\n'),
      'package/sub/character.def': strToU8('[Info]\nname = Nested Fighter\n[Files]\ncmd = .\\FILES\\FIGHTER.CMD\ncns = ../shared/fighter.cns\nanim = files/fighter.air\n'),
      'package/sub/files/fighter.cmd': strToU8('[Command]\nname = "a"\ncommand = a\ntime = 1\n'),
      'package/shared/Fighter.CNS': strToU8('[StateDef 0]\ntype = S\nmovetype = I\nphysics = S\nanim = 0\nctrl = 1\n'),
      'package/sub/FILES/Fighter.AIR': strToU8('Begin Action 0\n0,0, 0,0, 5\n'),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: RequestInfo | URL) => {
      if (String(path) === '/storage/random-upload-name.zip') return new Response(toArrayBuffer(zipBytes));
      if (String(path) === '/chars/common.cmd') return new Response('[Command]\nname = "holddown"\ncommand = /D\n');
      return new Response('missing', { status: 404 });
    }) as typeof fetch;

    try {
      const result = await loadAppCharacter('/storage/random-upload-name.zip');
      expect(result.errorMessage).toBeNull();
      expect(readCharacterRuntimeMetadata(result.character!)).toMatchObject({ name: 'Nested Fighter' });
      expect(result.character?.cnsSourceFiles?.map((file) => file.path)).toEqual(expect.arrayContaining([
        'package/sub/character.def',
        'package/sub/.\\FILES\\FIGHTER.CMD',
        'package/sub/../shared/fighter.cns',
        'package/sub/files/fighter.air',
      ]));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects ZIPs with multiple valid Character DEF files instead of selecting the first', async () => {
    const definition = '[Info]\nname = Fighter\n[Files]\ncmd = fighter.cmd\ncns = fighter.cns\nanim = fighter.air\n';
    const zipBytes = zipSync({ 'a.def': strToU8(definition), 'b/b.def': strToU8(definition) });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(toArrayBuffer(zipBytes))) as typeof fetch;
    try {
      const result = await loadAppCharacter('/storage/ambiguous.zip');
      expect(result.character).toBeNull();
      expect(result.errorMessage).toContain('multiple valid Character DEF');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it.each([
    { name: 'corrupt', bytes: new Uint8Array([1, 2, 3]), message: 'invalid zip data' },
    { name: 'without DEF', bytes: zipSync({ 'readme.txt': strToU8('not a character') }), message: 'no valid Character DEF' },
  ])('rejects a $name ZIP without falling back to an arbitrary entry', async ({ bytes, message }) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(toArrayBuffer(bytes))) as typeof fetch;
    try {
      const result = await loadAppCharacter('/storage/invalid.zip');
      expect(result.character).toBeNull();
      expect(result.errorMessage?.toLowerCase()).toContain(message.toLowerCase());
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('saves editable character text through the restricted development endpoint', async () => {
    const originalFetch = globalThis.fetch;
    let request: RequestInit | undefined;
    globalThis.fetch = (async (_path: RequestInfo | URL, init?: RequestInit) => {
      request = init;
      return new Response(JSON.stringify({ saved: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    try {
      await saveCharacterSourceFile({
        path: 'Demo/readme.txt', label: 'readme.txt', text: 'before', kind: 'text', editable: true,
        archivePath: '/chars/Demo.zip', archiveEntryPath: 'Demo/readme.txt',
      }, 'after');

      expect(request?.method).toBe('POST');
      expect(JSON.parse(String(request?.body))).toEqual({
        path: 'Demo/readme.txt',
        text: 'after',
        archivePath: '/chars/Demo.zip',
        archiveEntryPath: 'Demo/readme.txt',
      });
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
      expect(result.character?.cns.states.flatMap((state) => state.controllers).some((controller) => controller.type.toLowerCase() === 'explod')).toBe(true);
      expect(result.character?.cns.states.flatMap((state) => state.controllers).some((controller) => controller.type.toLowerCase() === 'playsnd')).toBe(true);
      const wallImpactSound = result.character?.cns.states.find((state) => state.stateNo === 3430)?.controllers.find((controller) =>
        controller.type.toLowerCase() === 'playsnd');
      expect(wallImpactSound?.triggers.map((trigger) => trigger.expression)).toContain('animelem = 3 && time < 10');
      expect(result.character?.air.actions.find((action) => action.actionNo === 3301)?.elements[0]).toMatchObject({
        groupNo: 999,
        imageNo: 6,
        duration: -1,
        flip: '',
        blend: 'A',
      });
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

  it('applies T-H-M-A jump startup velocity and palette-specific p9 logic', async () => {
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
      const p9Character = (await loadAppCharacter('/chars/T-H-M-A.zip', 9)).character;
      expect(p9Character).not.toBeNull();

      const sharedSpriteEntry = [...character!.sprites!.sprites.entries()].find(([, sprite]) => sprite.paletteMetadata?.externalActApplied);
      expect(sharedSpriteEntry).toBeDefined();
      const [sharedSpriteKey, p1SharedSprite] = sharedSpriteEntry!;
      const p9SharedSprite = p9Character!.sprites!.sprites.get(sharedSpriteKey);
      expect(p9SharedSprite?.paletteMetadata).toMatchObject({ externalActApplied: true });
      expect(p9SharedSprite?.imageData.data).not.toEqual(p1SharedSprite.imageData.data);

      const state = createInitialGameState();
      const p9State = createInitialGameState(undefined, readCharacterRuntimeMetadata(character!, 9));
      const p9Result = stepCnsStateRuntime(p9State, character!.cns, {
        p1Commands: new Set(),
        p2Commands: new Set(),
        getAnimationDuration: (animNo) => getAnimationDuration(character!.air, animNo),
      });
      expect(p9Result.state.players[0]).toMatchObject({ palNo: 9, power: 2000 });

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
      expect(readCnsConst(character!.cns, 'velocity.jump.neu.y')).toBe(-9.1);
      expect(readCnsConst(character!.cns, 'movement.yaccel')).toBe(0.47);
      expect(runtimeResult.state.players[0].vy).toBe(-9.1);
      expect(stepCnsPhysicsMotion(runtimeResult.state, character!.cns).players[0].vy).toBeCloseTo(-8.63);

      const delayedDirectional = stepCnsStateRuntime({
        ...state,
        players: [{
          ...state.players[0],
          stateNo: 40,
          animNo: 40,
          animTime: jumpStartupDuration,
          stateTime: jumpStartupDuration,
          ctrl: false,
          sysVars: { 1: 1 },
        }, state.players[1]],
      }, character!.cns, {
        p1Commands: new Set(),
        p2Commands: new Set(),
        getAnimationDuration: (animNo) => getAnimationDuration(character!.air, animNo),
      });
      const jumpVelocityController = character!.cns.states.find((candidate) => candidate.stateNo === 40)?.controllers.find((controller) => controller.type.toLowerCase() === 'velset' && controller.params.y !== undefined);
      expect(jumpVelocityController?.params.y).toContain('const(velocity.jump.y)');
      expect(character!.cns.states.find((candidate) => candidate.stateNo === 50)?.velocitySet).toBeUndefined();
      expect(readNumberExpression(String(jumpVelocityController!.params.y), { player: state.players[0], constants: character!.cns })).toBe(-9.1);
      expect(readNumberExpression(String(jumpVelocityController!.params.y), { player: { ...state.players[0], sysVars: { 1: 1 }, prevStateNo: 0 }, constants: character!.cns })).toBe(-9.1);
      expect(delayedDirectional.state.players[0]).toMatchObject({ stateNo: 50, vx: 3.4, vy: -6.4 });
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

      for (const [key, expectedDirection] of [['ArrowRight', 1], ['ArrowLeft', -1]] as const) {
        const directional = simulateCnsInputScenario(character!, [
          holdP1Keys([key, 'ArrowUp'], 2),
          neutral(8),
        ]);
        const airborne = directional.frames.find((frame) => frame.p1.stateNo === 50 && frame.p1.vy < 0);
        expect(airborne, directional.frames.map(formatScenarioFrame).join('\n')).toBeDefined();
        expect(Math.sign(airborne!.p1.vx)).toBe(expectedDirection);
      }
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
