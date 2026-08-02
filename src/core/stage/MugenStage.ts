import type { ImageDataSpritePack } from '../sprite/ImageDataSpriteTypes';

export type MugenStageLayer = {
  groupNo: number;
  imageNo: number;
  layerNo: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
};

export type MugenStage = {
  name: string;
  defPath: string;
  hiRes: boolean;
  zOffset: number;
  sprites: ImageDataSpritePack;
  layers: readonly MugenStageLayer[];
};
