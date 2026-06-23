import type { PcxHeader, PcxImage } from './PcxTypes';

const PCX_HEADER_SIZE = 128;
const PCX_PALETTE_MARKER = 0x0c;
const VGA_PALETTE_SIZE = 256 * 3;

export type DecodePcxOptions = {
  externalPalette?: Uint8Array;
  preferExternalPalette?: boolean;
  paletteIndexOrder?: 'normal' | 'reversed';
};

export function decodePcx(buffer: Uint8Array | ArrayBuffer, options: DecodePcxOptions = {}): PcxImage {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const header = parsePcxHeader(bytes);

  validateSupportedPcxHeader(header, bytes);

  const embeddedPalette = tryReadVgaPalette(bytes);
  const externalPalette = normalizeExternalPalette(options.externalPalette);
  const palette = options.preferExternalPalette
    ? externalPalette ?? embeddedPalette
    : embeddedPalette ?? externalPalette;

  if (!palette) {
    throw new Error('PCX VGA palette marker is missing.');
  }

  const imageDataStart = PCX_HEADER_SIZE;
  const imageDataEnd = embeddedPalette ? bytes.length - 1 - VGA_PALETTE_SIZE : bytes.length;
  const decoded = decodeRle(bytes.subarray(imageDataStart, imageDataEnd));
  const indexedPixels = extractIndexedPixels(decoded, header);
  const rgbaPixels = indexedToRgba(indexedPixels, palette, options.paletteIndexOrder ?? 'normal');

  return {
    header,
    palette,
    indexedPixels,
    rgbaPixels,
    width: header.width,
    height: header.height,
  };
}

export function parsePcxHeader(bytes: Uint8Array): PcxHeader {
  if (bytes.length < PCX_HEADER_SIZE) {
    throw new Error('PCX data is too small.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const xMin = view.getUint16(4, true);
  const yMin = view.getUint16(6, true);
  const xMax = view.getUint16(8, true);
  const yMax = view.getUint16(10, true);

  return {
    manufacturer: bytes[0],
    version: bytes[1],
    encoding: bytes[2],
    bitsPerPixel: bytes[3],
    xMin,
    yMin,
    xMax,
    yMax,
    hDpi: view.getUint16(12, true),
    vDpi: view.getUint16(14, true),
    colorPlanes: bytes[65],
    bytesPerLine: view.getUint16(66, true),
    paletteType: view.getUint16(68, true),
    width: xMax - xMin + 1,
    height: yMax - yMin + 1,
  };
}

export function decodeRle(data: Uint8Array): Uint8Array {
  const output: number[] = [];

  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];

    if ((value & 0xc0) === 0xc0) {
      const count = value & 0x3f;
      i += 1;
      if (i >= data.length) {
        throw new Error('Invalid PCX RLE stream.');
      }
      const repeatedValue = data[i];
      for (let j = 0; j < count; j += 1) {
        output.push(repeatedValue);
      }
      continue;
    }

    output.push(value);
  }

  return new Uint8Array(output);
}

export function tryReadVgaPalette(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < PCX_HEADER_SIZE + 1 + VGA_PALETTE_SIZE) {
    return null;
  }

  const paletteMarkerOffset = bytes.length - 1 - VGA_PALETTE_SIZE;
  if (bytes[paletteMarkerOffset] !== PCX_PALETTE_MARKER) {
    return null;
  }

  return bytes.slice(bytes.length - VGA_PALETTE_SIZE);
}

function validateSupportedPcxHeader(header: PcxHeader, bytes: Uint8Array): void {
  if (header.manufacturer !== 0x0a) {
    throw new Error(`Unsupported PCX manufacturer: ${header.manufacturer}`);
  }

  if (header.encoding !== 1) {
    throw new Error(`Unsupported PCX encoding: ${header.encoding}`);
  }

  if (header.bitsPerPixel !== 8 || header.colorPlanes !== 1) {
    throw new Error(
      `Unsupported PCX format: bitsPerPixel=${header.bitsPerPixel}, colorPlanes=${header.colorPlanes}`,
    );
  }

  if (bytes.length < PCX_HEADER_SIZE) {
    throw new Error('PCX data is too small.');
  }
}

function normalizeExternalPalette(palette: Uint8Array | undefined): Uint8Array | null {
  if (!palette) {
    return null;
  }

  if (palette.length !== VGA_PALETTE_SIZE) {
    throw new Error(`Invalid external PCX palette size: ${palette.length}`);
  }

  return palette;
}

function extractIndexedPixels(decoded: Uint8Array, header: PcxHeader): Uint8Array {
  const pixels = new Uint8Array(header.width * header.height);
  const requiredDecodedBytes = header.bytesPerLine * header.height;

  if (decoded.length < requiredDecodedBytes) {
    throw new Error(
      `Decoded PCX data is too short: expected ${requiredDecodedBytes}, got ${decoded.length}`,
    );
  }

  for (let y = 0; y < header.height; y += 1) {
    const sourceRowStart = y * header.bytesPerLine;
    const targetRowStart = y * header.width;

    for (let x = 0; x < header.width; x += 1) {
      pixels[targetRowStart + x] = decoded[sourceRowStart + x];
    }
  }

  return pixels;
}

function indexedToRgba(
  indexedPixels: Uint8Array,
  palette: Uint8Array,
  paletteIndexOrder: 'normal' | 'reversed',
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(indexedPixels.length * 4);

  for (let i = 0; i < indexedPixels.length; i += 1) {
    const sourceIndex = indexedPixels[i];
    const colorIndex = paletteIndexOrder === 'reversed' ? 255 - sourceIndex : sourceIndex;
    const paletteIndex = colorIndex * 3;
    const rgbaIndex = i * 4;

    rgba[rgbaIndex] = palette[paletteIndex];
    rgba[rgbaIndex + 1] = palette[paletteIndex + 1];
    rgba[rgbaIndex + 2] = palette[paletteIndex + 2];
    rgba[rgbaIndex + 3] = sourceIndex === 0 ? 0 : 255;
  }

  return rgba;
}
