import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../../core/engine/GameState';
import type { ExplodRuntimeEntry } from '../../core/explod/ExplodSystem';
import { convertSffDocumentToImageDataSpritePack, convertSffV1ToImageDataSpritePack } from '../../core/sprite/SffSpritePackConverter';
import type { ImageDataSpritePack } from '../../core/sprite/ImageDataSpriteTypes';
import { spriteKey } from '../../core/sprite/SpritePackLoader';
import type { SpriteKey } from '../../core/sprite/SpriteTypes';
import type { AirDocument } from '../../parser/air/AirTypes';
import { parseSffV1 } from '../../parser/sff/SffParser';
import type { SffDocument, SffSpriteNode } from '../../parser/sff/SffTypes';
import { CanvasRenderer } from './CanvasRenderer';
import { ImageDataSpriteRenderer } from './ImageDataSpriteRenderer';

class FakeImageData {
  constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
}

(globalThis as unknown as { ImageData: typeof ImageData }).ImageData = FakeImageData as unknown as typeof ImageData;

describe('Explod indexed palette regression', () => {
  it('keeps the selected shared palette separate from sprite-specific palettes', () => {
    const sharedEmbedded = palette([180, 20, 30]);
    const selectedAct = palette([20, 80, 220]);
    const blackPlaceholder = palette([0, 0, 0]);
    const effectPalette = palette([20, 210, 70]);
    const document = sffDocument([
      { samePalette: false, pcx: pcx([0, 1], sharedEmbedded) },
      { samePalette: true, pcx: pcx([0, 1], blackPlaceholder) },
      { samePalette: false, pcx: pcx([0, 1], effectPalette) },
      { samePalette: true, pcx: pcx([0, 1]) },
    ]);

    const pack = convertSffDocumentToImageDataSpritePack(document, {
      externalPalette: selectedAct,
      preferExternalPalette: true,
    });

    expect(rgba(pack, '10,0')).toEqual([0, 0, 0, 0, 180, 20, 30, 255]);
    expect(rgba(pack, '10,1')).toEqual([0, 0, 0, 0, 180, 20, 30, 255]);
    expect(rgba(pack, '10,2')).toEqual([0, 0, 0, 0, 20, 210, 70, 255]);
    expect(rgba(pack, '10,3')).toEqual([0, 0, 0, 0, 20, 210, 70, 255]);
    expect(pack.sprites.get('10,3')?.paletteMetadata).toMatchObject({
      source: 'sprite-specific-chain',
      externalActApplied: false,
      sampleIndex: 1,
      sampleRgba: [20, 210, 70, 255],
    });
  });

  it('does not reuse a group/index canvas across different owner assets', () => {
    const canvases: FakeCanvas[] = [];
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { createElement: () => { const canvas = fakeOffscreenCanvas(); canvases.push(canvas); return canvas; } },
    });
    try {
      const renderer = new ImageDataSpriteRenderer();
      const red = imagePack([200, 10, 20, 255]);
      const green = imagePack([10, 220, 30, 255]);

      const redCanvas = renderer.findCanvas(red, 10, 0) as unknown as FakeCanvas;
      const greenCanvas = renderer.findCanvas(green, 10, 0) as unknown as FakeCanvas;

      expect(redCanvas).not.toBe(greenCanvas);
      expect(redCanvas.rgba).toEqual([200, 10, 20, 255]);
      expect(greenCanvas.rgba).toEqual([10, 220, 30, 255]);
      expect(canvases).toHaveLength(2);
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    }
  });

  it('uses the same owner RGBA for normal and Explod draws without changing blend or transforms', () => {
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => fakeOffscreenCanvas() } });
    try {
      const drawImage = vi.fn();
      const scale = vi.fn();
      const context = fakeMainContext(drawImage, scale);
      const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
      const red = imagePack([200, 10, 20, 255]);
      const green = imagePack([10, 220, 30, 255]);
      const air = airDocument();
      const state = createInitialGameState();
      state.explods.entries = [explod(false, 1), explod(true, 2)];
      const renderer = new CanvasRenderer(canvas, air, null, red, {
        1: { airDocument: air, imageDataSpritePack: red },
        2: { airDocument: air, imageDataSpritePack: green },
      });

      const diagnostics = renderer.render(state).join('\n');
      const drawn = drawImage.mock.calls.map(([source]) => (source as unknown as FakeCanvas).rgba);

      expect(drawn).toEqual([
        [200, 10, 20, 255],
        [10, 220, 30, 255],
        [10, 220, 30, 255],
        [10, 220, 30, 255],
      ]);
      expect(drawImage.mock.calls[2][0]).not.toBe(drawImage.mock.calls[3][0]);
      expect(scale).toHaveBeenCalledWith(-2, -3);
      expect(diagnostics).toContain('trans=addalpha alpha=(128,128) composite=lighter ownpal=0');
      expect(diagnostics).toContain('ownpal=0 rgba_nontransparent=1 rgba_nonblack=1');
      expect(diagnostics).toContain('ownpal=1 rgba_nontransparent=1 rgba_nonblack=1');
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    }
  });

  it('rejects SFF v2 instead of decoding it as the supported v1 layout', () => {
    const bytes = new Uint8Array(64);
    bytes.set(new TextEncoder().encode('ElecbyteSpr\0'), 0);
    bytes[15] = 2;
    new DataView(bytes.buffer).setInt32(28, 32, true);

    expect(() => parseSffV1(bytes.buffer)).toThrow(/SFF v2/i);
  });

  it('keeps the real KFM shared-palette Explod sprite non-black', async () => {
    const sff = await readFile('public/chars/kfm/kfm.sff');
    const act = await readFile('public/chars/kfm/kfm6.act');
    const pack = convertSffV1ToImageDataSpritePack(exactBuffer(sff), {
      externalPalette: act,
      preferExternalPalette: true,
      paletteIndexOrder: 'reversed',
    });

    const normal = colorStats(pack.sprites.get('0,0')!.imageData.data);
    const explod = colorStats(pack.sprites.get('191,0')!.imageData.data);
    expect(normal).toMatchObject({ nonTransparent: expect.any(Number), nonBlack: expect.any(Number) });
    expect(explod).toMatchObject({ nonTransparent: expect.any(Number), nonBlack: expect.any(Number) });
    expect(normal.nonTransparent).toBeGreaterThan(0);
    expect(normal.nonBlack).toBeGreaterThan(0);
    expect(explod.nonTransparent).toBeGreaterThan(0);
    expect(explod.nonBlack).toBeGreaterThan(0);
  });

  it('keeps real T-H-M-A Action 15001 sprite-specific palettes before AIR Preview or Explod rendering', async () => {
    const sff = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.sff');
    const act = await readFile('public/chars/T-H-M-A/T-H-M-A/Act/t3.act');
    const pack = convertSffV1ToImageDataSpritePack(exactBuffer(sff), {
      externalPalette: act,
      preferExternalPalette: true,
      paletteIndexOrder: 'reversed',
    });

    const expectedSamples = new Map([
      [0, { sampleIndex: 161, sampleRgba: [206, 190, 157, 255] }],
      [1, { sampleIndex: 161, sampleRgba: [206, 190, 157, 255] }],
      [2, { sampleIndex: 162, sampleRgba: [174, 157, 125, 255] }],
      [3, { sampleIndex: 163, sampleRgba: [141, 125, 93, 255] }],
      [11, { sampleIndex: 161, sampleRgba: [206, 190, 157, 255] }],
    ]);

    for (let imageNo = 0; imageNo <= 11; imageNo += 1) {
      const sprite = pack.sprites.get(spriteKey(15000, imageNo));
      expect(sprite?.paletteMetadata).toMatchObject({
        source: 'sprite-specific-pcx',
        externalActApplied: false,
        embeddedPalette: true,
        samePaletteRaw: 0,
      });
      expect(colorStats(sprite!.imageData.data).nonBlack).toBeGreaterThan(0);
    }
    for (const [imageNo, expected] of expectedSamples) {
      expect(pack.sprites.get(spriteKey(15000, imageNo))?.paletteMetadata).toMatchObject(expected);
    }
  });
});

type FakeCanvas = HTMLCanvasElement & { rgba: number[] };

function fakeOffscreenCanvas(): FakeCanvas {
  const canvas = { width: 0, height: 0, rgba: [] as number[] } as unknown as FakeCanvas;
  canvas.getContext = ((() => ({
    putImageData(imageData: ImageData) { canvas.rgba = Array.from(imageData.data); },
  })) as unknown) as HTMLCanvasElement['getContext'];
  return canvas;
}

function fakeMainContext(drawImage: ReturnType<typeof vi.fn>, scale: ReturnType<typeof vi.fn>): CanvasRenderingContext2D {
  return {
    globalAlpha: 1, globalCompositeOperation: 'source-over', clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(),
    fill: vi.fn(), fillText: vi.fn(), drawImage, scale,
  } as unknown as CanvasRenderingContext2D;
}

function imagePack(color: [number, number, number, number]): ImageDataSpritePack {
  return { sprites: new Map([['10,0', { groupNo: 10, imageNo: 0, xAxis: 0, yAxis: 0, imageData: new FakeImageData(new Uint8ClampedArray(color), 1, 1) as unknown as ImageData }]]) };
}

function rgba(pack: ImageDataSpritePack, key: SpriteKey): number[] {
  return Array.from(pack.sprites.get(key)!.imageData.data);
}

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function colorStats(data: Uint8ClampedArray): { nonTransparent: number; nonBlack: number } {
  let nonTransparent = 0;
  let nonBlack = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    nonTransparent += 1;
    if (data[index] || data[index + 1] || data[index + 2]) nonBlack += 1;
  }
  return { nonTransparent, nonBlack };
}

function palette(color: [number, number, number]): Uint8Array {
  const result = new Uint8Array(256 * 3);
  result.set(color, 3);
  return result;
}

function pcx(indices: [number, number], colors?: Uint8Array): Uint8Array {
  const header = new Uint8Array(128);
  const view = new DataView(header.buffer);
  header[0] = 0x0a; header[1] = 5; header[2] = 1; header[3] = 8; header[65] = 1;
  view.setUint16(8, 1, true); view.setUint16(10, 0, true); view.setUint16(66, 2, true); view.setUint16(68, 1, true);
  const tail = colors ? new Uint8Array([0x0c, ...colors]) : new Uint8Array();
  return new Uint8Array([...header, ...indices, ...tail]);
}

function sffDocument(entries: Array<{ samePalette: boolean; pcx: Uint8Array }>): SffDocument {
  const sprites: SffSpriteNode[] = [];
  let offset = 64;
  const data = new Uint8Array(64 + entries.reduce((sum, entry) => sum + entry.pcx.length, 0));
  entries.forEach((entry, index) => {
    data.set(entry.pcx, offset);
    sprites.push({ index, nextOffset: 0, length: entry.pcx.length, xAxis: 0, yAxis: 0, groupNo: 10, imageNo: index, linkedIndex: -1, samePalette: entry.samePalette, comment: '', dataOffset: offset, isLinked: false });
    offset += entry.pcx.length;
  });
  return { header: { signature: 'ElecbyteSpr\0', version: { major: 1, minor: 0, patch: 1, beta: 0 }, groupCount: 1, imageCount: entries.length, firstSubfileOffset: 64, subheaderSize: 32, paletteType: 1 }, sprites, data };
}

function airDocument(): AirDocument {
  const element = { groupNo: 10, imageNo: 0, offsetX: 0, offsetY: 0, duration: 4, clsn1: [], clsn2: [] };
  return { actions: [0, 100].map((actionNo) => ({ actionNo, elements: [element], defaultClsn1: [], defaultClsn2: [] })) };
}

function explod(ownPalette: boolean, runtimeId: number): ExplodRuntimeEntry {
  return {
    runtimeId, mugenId: runtimeId, owner: { entityId: 2, rootPlayerId: 2 }, animationOwner: { entityId: 2, rootPlayerId: 2 }, animationSource: 'owner', animNo: 100, animTime: 0, animElement: 0,
    creationFrame: 0, age: 0, removeTimeElapsed: 0, removeTimeStartFrame: 0, position: { x: 320, y: 240 }, offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 },
    facing: -1, verticalFacing: -1, postype: 'p2', coordinateSpace: 'stage', bind: null, removeTime: null, removalReason: null, spritePriority: 1, onTop: false,
    pauseMoveTime: 0, superMoveTime: 0, removeOnGetHit: false, random: { x: 0, y: 0 },
    render: { transparency: 'addalpha', alpha: { source: 128, destination: 128 }, scaleX: 2, scaleY: 3, ownPalette, shadow: { red: 0, green: 0, blue: 0 } },
  };
}
