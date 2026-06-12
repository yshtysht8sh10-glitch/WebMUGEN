import { describe, expect, it } from 'vitest';
import { convertSffDocumentToImageDataSpritePack, resolveLinkedSprite } from './SffSpritePackConverter';
import type { SffDocument } from '../../parser/sff/SffTypes';

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

function createFake8BitPcx(): Uint8Array {
  const width = 2;
  const height = 1;
  const bytesPerLine = 2;
  const header = new Uint8Array(128);
  const view = new DataView(header.buffer);

  header[0] = 0x0a;
  header[1] = 5;
  header[2] = 1;
  header[3] = 8;
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, width - 1, true);
  view.setUint16(10, height - 1, true);
  header[65] = 1;
  view.setUint16(66, bytesPerLine, true);
  view.setUint16(68, 1, true);

  const imageData = new Uint8Array([1, 2]);
  const paletteMarker = new Uint8Array([0x0c]);
  const palette = new Uint8Array(256 * 3);
  palette[3] = 10;
  palette[4] = 20;
  palette[5] = 30;
  palette[6] = 40;
  palette[7] = 50;
  palette[8] = 60;

  const result = new Uint8Array(header.length + imageData.length + paletteMarker.length + palette.length);
  result.set(header, 0);
  result.set(imageData, header.length);
  result.set(paletteMarker, header.length + imageData.length);
  result.set(palette, header.length + imageData.length + paletteMarker.length);
  return result;
}

function createDocument(): SffDocument {
  const pcx = createFake8BitPcx();
  const data = new Uint8Array(64 + 32 + pcx.length + 32);
  data.set(pcx, 96);

  return {
    header: {
      signature: 'ElecbyteSpr\\0',
      version: { major: 1, minor: 1, patch: 0, beta: 0 },
      groupCount: 1,
      imageCount: 2,
      firstSubfileOffset: 64,
      subheaderSize: 32,
      paletteType: 1,
    },
    data,
    sprites: [
      {
        index: 0,
        nextOffset: 96 + pcx.length,
        length: pcx.length,
        xAxis: 16,
        yAxis: 78,
        groupNo: 200,
        imageNo: 2,
        linkedIndex: -1,
        samePalette: true,
        comment: '',
        dataOffset: 96,
        isLinked: false,
      },
      {
        index: 1,
        nextOffset: 0,
        length: 0,
        xAxis: 18,
        yAxis: 80,
        groupNo: 200,
        imageNo: 3,
        linkedIndex: 0,
        samePalette: true,
        comment: '',
        dataOffset: 96 + pcx.length + 32,
        isLinked: true,
      },
    ],
  };
}

describe('SffSpritePackConverter', () => {
  it('converts SFF sprite PCX data to ImageData sprite pack', () => {
    const pack = convertSffDocumentToImageDataSpritePack(createDocument());
    const sprite = pack.sprites.get('200,2');

    expect(sprite).toBeDefined();
    expect(sprite?.xAxis).toBe(16);
    expect(sprite?.yAxis).toBe(78);
    expect(sprite?.imageData.width).toBe(2);
    expect(sprite?.imageData.height).toBe(1);
    expect(Array.from(sprite!.imageData.data.slice(0, 8))).toEqual([
      10, 20, 30, 255,
      40, 50, 60, 255,
    ]);
  });

  it('resolves linked sprites and keeps linked sprite axis', () => {
    const doc = createDocument();
    const linked = doc.sprites[1];

    expect(resolveLinkedSprite(doc, linked)).toBe(doc.sprites[0]);

    const pack = convertSffDocumentToImageDataSpritePack(doc);
    const sprite = pack.sprites.get('200,3');

    expect(sprite).toBeDefined();
    expect(sprite?.xAxis).toBe(18);
    expect(sprite?.yAxis).toBe(80);
    expect(sprite?.imageData.width).toBe(2);
  });
});
