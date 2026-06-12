import type { SpriteKey } from './SpriteTypes';

export type ImageDataSprite = {
  groupNo: number;
  imageNo: number;
  xAxis: number;
  yAxis: number;
  imageData: ImageData;
};

export type ImageDataSpritePack = {
  sprites: Map<SpriteKey, ImageDataSprite>;
};
