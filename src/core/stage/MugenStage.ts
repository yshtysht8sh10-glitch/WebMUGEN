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

export type MugenStageCamera = {
  startX: number;
  startY: number;
  boundLeft: number;
  boundRight: number;
  boundHigh: number;
  boundLow: number;
  verticalFollow: number;
  floorTension: number;
  tension: number;
};

export type MugenStagePlayerInfo = {
  p1StartX: number;
  p1StartY: number;
  p1Facing: 1 | -1;
  p2StartX: number;
  p2StartY: number;
  p2Facing: 1 | -1;
  leftBound: number;
  rightBound: number;
};

export type MugenStage = {
  name: string;
  defPath: string;
  hiRes: boolean;
  autoTurn?: boolean;
  zOffset: number;
  camera: MugenStageCamera;
  playerInfo: MugenStagePlayerInfo;
  screenBound: { left: number; right: number };
  sprites: ImageDataSpritePack;
  layers: readonly MugenStageLayer[];
};
