import { selectAirFrame, type AirAnimation } from '../air/AirFrameTimeline';
import { projectCollisionBoxes, type CollisionBox, type ScreenCollisionBox } from '../collision/CollisionOverlay';
import { computeSpritePlacement, type ActorRenderPose, type SpriteAssetInfo, type SpritePlacement } from './SpritePlacement';
import { applyTransformToSize, computeSpriteTransform, type RenderScale, type SpriteTransform } from './SpriteTransform';

export type RenderFramePlan = {
  actionNo: number;
  frameIndex: number;
  sprite: {
    group: number;
    image: number;
  };
  placement: SpritePlacement;
  transform: SpriteTransform;
  collisionBoxes: ScreenCollisionBox[];
};

export function createRenderFramePlan(params: {
  animation: AirAnimation;
  animationTime: number;
  pose: ActorRenderPose;
  sprite: SpriteAssetInfo;
  scale?: RenderScale;
  collisionBoxes?: readonly CollisionBox[];
  loop?: boolean;
}): RenderFramePlan | null {
  const selected = selectAirFrame(params.animation, params.animationTime, params.loop ?? true);
  if (!selected) {
    return null;
  }

  const transform = computeSpriteTransform(selected.frame, params.pose.facing, params.scale);
  const placement = computeSpritePlacement(params.pose, selected.frame, params.sprite);
  const scaledSize = applyTransformToSize(placement.width, placement.height, transform);

  return {
    actionNo: params.animation.actionNo,
    frameIndex: selected.frameIndex,
    sprite: {
      group: selected.frame.group,
      image: selected.frame.image,
    },
    placement: {
      ...placement,
      width: scaledSize.width,
      height: scaledSize.height,
    },
    transform,
    collisionBoxes: projectCollisionBoxes(
      params.collisionBoxes ?? [],
      { x: params.pose.x, y: params.pose.y },
      params.pose.facing,
      params.scale ?? { x: 1, y: 1 },
    ),
  };
}
