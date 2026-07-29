import type { SpriteKey } from './SpriteTypes';

export type ImageDataSprite = {
  groupNo: number;
  imageNo: number;
  xAxis: number;
  yAxis: number;
  imageData: ImageData;
  /** Retained only for the best ACT preview sprite (0,0, then group 0, then first decodable). */
  indexedPixels?: Uint8Array;
  paletteKey?: string;
  paletteMetadata?: {
    source: string;
    ownerGroupNo?: number;
    ownerImageNo?: number;
    ownerSequence?: number;
    samePaletteRaw: number;
    linked: boolean;
    linkedSource?: number;
    embeddedPalette: boolean;
    externalActApplied: boolean;
    paletteIndexOrder?: 'normal' | 'reversed';
    sampleIndex?: number;
    sampleRgba?: [number, number, number, number];
  };
};

export type ImageDataPalette = {
  bytes: Uint8Array;
  indexOrder: 'normal' | 'reversed';
};

export type ImageDataSpritePack = {
  sprites: Map<SpriteKey, ImageDataSprite>;
  palettes?: Map<string, ImageDataPalette>;
  cacheKey?: string;
};
