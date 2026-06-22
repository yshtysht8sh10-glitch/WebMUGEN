import type { AirFrame } from '../air/AirFrameTimeline';

export type RenderScale = {
  x: number;
  y: number;
};

export type SpriteTransform = {
  scaleX: number;
  scaleY: number;
  flipH: boolean;
  flipV: boolean;
};

export function computeSpriteTransform(
  frame: AirFrame,
  facing: 1 | -1,
  scale: RenderScale = { x: 1, y: 1 },
): SpriteTransform {
  const frameFlipH = frame.flipH === true;
  const facingFlipH = facing === -1;

  return {
    scaleX: Math.abs(scale.x),
    scaleY: Math.abs(scale.y),
    flipH: frameFlipH !== facingFlipH,
    flipV: frame.flipV === true,
  };
}

export function applyTransformToSize(width: number, height: number, transform: SpriteTransform): { width: number; height: number } {
  return {
    width: width * transform.scaleX,
    height: height * transform.scaleY,
  };
}
