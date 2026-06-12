export type PcxHeader = {
  manufacturer: number;
  version: number;
  encoding: number;
  bitsPerPixel: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  hDpi: number;
  vDpi: number;
  colorPlanes: number;
  bytesPerLine: number;
  paletteType: number;
  width: number;
  height: number;
};

export type PcxImage = {
  header: PcxHeader;
  palette: Uint8Array;
  indexedPixels: Uint8Array;
  rgbaPixels: Uint8ClampedArray;
  width: number;
  height: number;
};
