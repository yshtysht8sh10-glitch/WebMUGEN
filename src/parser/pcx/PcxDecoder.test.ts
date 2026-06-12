import { describe, expect, it } from 'vitest';
import { decodePcx, decodeRle, parsePcxHeader, tryReadVgaPalette } from './PcxDecoder';

function createFake8BitPcx(withPalette = true): Uint8Array {
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

  const imageData = new Uint8Array([1, 2, 3, 0, 4, 5, 6, 0]);
  const palette = createPalette();

  if (!withPalette) {
    const result = new Uint8Array(header.length + imageData.length);
    result.set(header, 0);
    result.set(imageData, header.length);
    return result;
  }

  const paletteMarker = new Uint8Array([0x0c]);
  const result = new Uint8Array(header.length + imageData.length + paletteMarker.length + palette.length);
  result.set(header, 0);
  result.set(imageData, header.length);
  result.set(paletteMarker, header.length + imageData.length);
  result.set(palette, header.length + imageData.length + paletteMarker.length);
  return result;
}

function createPalette(): Uint8Array {
  const palette = new Uint8Array(256 * 3);
  for (let i = 1; i <= 6; i += 1) {
    palette[i * 3] = i * 10;
    palette[i * 3 + 1] = i * 10 + 1;
    palette[i * 3 + 2] = i * 10 + 2;
  }
  return palette;
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

  it('reads embedded VGA palette', () => {
    const palette = tryReadVgaPalette(createFake8BitPcx());

    expect(palette).toBeDefined();
    expect(palette?.length).toBe(768);
  });

  it('decodes indexed pixels and RGBA pixels', () => {
    const image = decodePcx(createFake8BitPcx());

    expect(Array.from(image.indexedPixels)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(Array.from(image.rgbaPixels.slice(0, 8))).toEqual([
      10, 11, 12, 255,
      20, 21, 22, 255,
    ]);
    expect(image.width).toBe(3);
    expect(image.height).toBe(2);
  });

  it('decodes PCX without embedded palette by using external shared palette', () => {
    const image = decodePcx(createFake8BitPcx(false), {
      externalPalette: createPalette(),
    });

    expect(Array.from(image.indexedPixels)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(Array.from(image.rgbaPixels.slice(0, 4))).toEqual([10, 11, 12, 255]);
  });

  it('throws when palette is missing and no external palette is provided', () => {
    expect(() => decodePcx(createFake8BitPcx(false))).toThrow('PCX VGA palette marker is missing.');
  });

  it('uses palette index 0 as transparent', () => {
    const pcx = createFake8BitPcx();
    pcx[128] = 0;

    const image = decodePcx(pcx);

    expect(image.rgbaPixels[3]).toBe(0);
  });
});
