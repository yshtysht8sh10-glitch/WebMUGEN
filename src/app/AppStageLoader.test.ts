import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { loadMugenStageZip } from './AppStageLoader';

class FakeImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
}

(globalThis as unknown as { ImageData: typeof ImageData }).ImageData = FakeImageData as unknown as typeof ImageData;

describe('MUGEN stage ZIP loader', () => {
  it('reports a missing referenced SFF without silently using a fallback', async () => {
    const archive = zipSync({
      'stage/demo.def': strToU8('[Info]\nname = Demo\n[BGDef]\nspr = demo.sff\n[BG 0]\ntype = normal\nspriteno = 0,0'),
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(archive)));

    await expect(loadMugenStageZip('/stages/demo.zip')).rejects.toThrow('Stage SFF is missing');
    vi.unstubAllGlobals();
  });

  it('rejects archives without a stage DEF', async () => {
    const archive = zipSync({ 'readme.txt': strToU8('demo') });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(archive)));

    await expect(loadMugenStageZip('/stages/demo.zip')).rejects.toThrow('does not contain a DEF');
    vi.unstubAllGlobals();
  });

  it('loads the bundled Hi-Res beach stage and its two normal layers', async () => {
    const archive = await readFile('public/stages/material-22-archive.zip');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(archive)));

    const stage = await loadMugenStageZip('/stages/material-22-archive.zip');

    expect(stage).toMatchObject({ name: 'Beach in summer A', hiRes: true, zOffset: 220 });
    expect(stage.layers).toEqual([
      expect.objectContaining({ groupNo: 0, imageNo: 1, startX: -640, startY: -220, deltaX: 2, deltaY: 2 }),
      expect.objectContaining({ groupNo: 0, imageNo: 0, startX: -640, startY: -220, deltaX: 2, deltaY: 2 }),
    ]);
    expect(stage.sprites.sprites.has('0,0')).toBe(true);
    expect(stage.sprites.sprites.has('0,1')).toBe(true);
    expect(stage.sprites.sprites.get('0,1')).toMatchObject({ xAxis: 0, yAxis: 0 });
    expect(stage.sprites.sprites.get('0,1')?.imageData).toMatchObject({ width: 1280, height: 666 });
    expect(stage.sprites.sprites.get('0,0')).toMatchObject({ xAxis: 0, yAxis: -484 });
    vi.unstubAllGlobals();
  }, 20_000);
});
