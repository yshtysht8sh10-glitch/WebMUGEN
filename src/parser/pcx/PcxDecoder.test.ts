import { describe, expect, it } from 'vitest';
import { decodePcx, decodeRle, parsePcxHeader } from './PcxDecoder';

function createFake8BitPcx(): Uint8Array {
  const width = 3;
  const height = 2;
  const bytesPerLine = 4;
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
  view.setUint16(12, 72, true);
  view.setUint16(14, 72, true);

  header[65] = 1;
  view.setUint16(66, bytesPerLine, true);
  view.setUint16(68, 1, true);

  // Two rows, each padded to bytesPerLine.
  // Row0: 1,2,3,pad0
  // Row1: 4,5,6,pad0
  const imageData = new Uint8Array([
    1, 2, 3, 0,
    4, 5, 6, 0,
  ]);

  const paletteMarker = new Uint8Array([0x0c]);
  const palette = new Uint8Array(256 * 3);
  palette[1 * 3] = 10;
  palette[1 * 3 + 1] = 20;
  palette[1 * 3 + 2] = 30;
  palette[2 * 3] = 40;
  palette[2 * 3 + 1] = 50;
  palette[2 * 3 + 2] = 60;
  palette[3 * 3] = 70;
  palette[3 * 3 + 1] = 80;
  palette[3 * 3 + 2] = 90;
  palette[4 * 3] = 100;
  palette[4 * 3 + 1] = 110;
  palette[4 * 3 + 2] = 120;
  palette[5 * 3] = 130;
  palette[5 * 3 + 1] = 140;
  palette[5 * 3 + 2] = 150;
  palette[6 * 3] = 160;
  palette[6 * 3 + 1] = 170;
  palette[6 * 3 + 2] = 180;

  const result = new Uint8Array(header.length + imageData.length + paletteMarker.length + palette.length);
  result.set(header, 0);
  result.set(imageData, header.length);
  result.set(paletteMarker, header.length + imageData.length);
  result.set(palette, header.length + imageData.length + paletteMarker.length);

  return result;
}

describe('PcxDecoder', () => {
  it('decodes PCX RLE stream', () => {
    expect(Array.from(decodeRle(new Uint8Array([0xc3, 7, 8])))).toEqual([7, 7, 7, 8]);
  });

  it('parses 8bit PCX header', () => {
    const header = parsePcxHeader(createFake8BitPcx());

    expect(header.width).toBe(3);
    expect(header.height).toBe(2);
    expect(header.bitsPerPixel).toBe(8);
    expect(header.colorPlanes).toBe(1);
    expect(header.bytesPerLine).toBe(4);
  });

  it('decodes indexed pixels and RGBA pixels', () => {
    const image = decodePcx(createFake8BitPcx());

    expect(Array.from(image.indexedPixels)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(Array.from(image.rgbaPixels.slice(0, 8))).toEqual([
      10, 20, 30, 255,
      40, 50, 60, 255,
    ]);
    expect(image.width).toBe(3);
    expect(image.height).toBe(2);
  });

  it('uses palette index 0 as transparent', () => {
    const pcx = createFake8BitPcx();
    pcx[128] = 0;

    const image = decodePcx(pcx);

    expect(image.rgbaPixels[3]).toBe(0);
  });
});
