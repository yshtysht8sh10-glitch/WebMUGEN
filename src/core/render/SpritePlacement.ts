import type { AirFrame } from '../air/AirFrameTimeline';

export type SpriteAssetInfo = {
  width: number;
  height: number;
  axisX: number;
  axisY: number;
};

export type ActorRenderPose = {
  x: number;
  y: number;
  facing: 1 | -1;
};

export type SpritePlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function computeSpritePlacement(
  pose: ActorRenderPose,
  frame: AirFrame,
  sprite: SpriteAssetInfo,
): SpritePlacement {
  const frameX = frame.x * pose.facing;

  return {
    x: pose.x + frameX - sprite.axisX,
    y: pose.y + frame.y - sprite.axisY,
    width: sprite.width,
    height: sprite.height,
  };
}
