import { describe, expect, it } from 'vitest';
import { createRenderFramePlan } from './RenderFramePlan';

describe('Phase86 RenderFramePlan', () => {
  it('combines AIR timing, sprite placement, transform, and collision overlay', () => {
    const plan = createRenderFramePlan({
      animation: {
        actionNo: 200,
        frames: [
          { group: 0, image: 0, x: 0, y: 0, duration: 2 },
          { group: 0, image: 1, x: 5, y: -10, duration: 2, flipH: true },
        ],
      },
      animationTime: 2,
      pose: { x: 100, y: 200, facing: -1 },
      sprite: { width: 40, height: 60, axisX: 20, axisY: 50 },
      scale: { x: 2, y: 1 },
      collisionBoxes: [
        { kind: 'clsn1', left: -10, top: -20, right: 15, bottom: 5 },
      ],
    });

    expect(plan).toMatchObject({
      actionNo: 200,
      frameIndex: 1,
      sprite: { group: 0, image: 1 },
      placement: { x: 75, y: 140, width: 80, height: 60 },
      transform: { scaleX: 2, scaleY: 1, flipH: false, flipV: false },
    });
    expect(plan?.collisionBoxes[0]).toMatchObject({ x: 70, y: 180, width: 50, height: 25 });
  });
});
