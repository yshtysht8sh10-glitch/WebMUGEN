import type { SpriteKey } from './SpriteTypes';

export type ImageDataSprite = {
  groupNo: number;
  imageNo: number;
  xAxis: number;
  yAxis: number;
  imageData: ImageData;
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
    sampleIndex?: number;
    sampleRgba?: [number, number, number, number];
  };
};

export type ImageDataSpritePack = {
  sprites: Map<SpriteKey, ImageDataSprite>;
  cacheKey?: string;
};
