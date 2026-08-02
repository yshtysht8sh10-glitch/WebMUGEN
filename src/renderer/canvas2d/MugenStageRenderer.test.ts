import { describe, expect, it } from 'vitest';
import { resolveStageLayerPosition } from './CanvasRenderer';

describe('MUGEN stage layer positioning', () => {
  it('places the bundled Hi-Res base layer at the physical viewport origin', () => {
    expect(resolveStageLayerPosition({
      viewportWidth: 640,
      zOffset: 220,
      startX: -640,
      startY: -220,
      spriteAxisX: 0,
      spriteAxisY: 0,
      cameraX: 0,
      cameraY: 0,
      deltaX: 2,
      deltaY: 2,
    })).toEqual({ x: -320, y: 0 });
  });

  it('applies sprite axes and camera delta in stage-definition coordinates', () => {
    expect(resolveStageLayerPosition({
      viewportWidth: 640,
      zOffset: 220,
      startX: -640,
      startY: -220,
      spriteAxisX: 0,
      spriteAxisY: -484,
      cameraX: 10,
      cameraY: -5,
      deltaX: 2,
      deltaY: 2,
    })).toEqual({ x: -340, y: 494 });
  });
});
