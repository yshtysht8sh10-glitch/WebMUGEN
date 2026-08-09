import { describe, expect, it } from 'vitest';
import { resolveStageCameraPosition, resolveStageLayerPosition } from './CanvasRenderer';

describe('MUGEN stage layer positioning', () => {
  it('centers the bundled Hi-Res base layer across the classic physical viewport', () => {
    expect(resolveStageLayerPosition({
      viewportWidth: 640,
      startX: -640,
      startY: -220,
      spriteAxisX: 0,
      spriteAxisY: 0,
      cameraX: 0,
      cameraY: 0,
      deltaX: 2,
      deltaY: 2,
    })).toEqual({ x: -320, y: -220 });
  });

  it('covers the extended 800px source viewport from the same stage camera origin', () => {
    expect(resolveStageLayerPosition({
      viewportWidth: 800,
      startX: -640,
      startY: -220,
      spriteAxisX: 0,
      spriteAxisY: 0,
      cameraX: 0,
      cameraY: 0,
      deltaX: 2,
      deltaY: 2,
    })).toEqual({ x: -240, y: -220 });
  });

  it('keeps the bundled base layer flush with the extended viewport at adjusted camera bounds', () => {
    const positionAt = (cameraX: number) => resolveStageLayerPosition({
      viewportWidth: 800,
      startX: -640,
      startY: -220,
      spriteAxisX: 0,
      spriteAxisY: 0,
      cameraX,
      cameraY: 0,
      deltaX: 2,
      deltaY: 2,
    });

    expect(positionAt(-120).x).toBe(0);
    expect(positionAt(120).x).toBe(-480);
  });

  it('keeps the bundled sky flush with the viewport top at the DEF upper camera bound', () => {
    expect(resolveStageLayerPosition({
      viewportWidth: 800,
      startX: -640,
      startY: -220,
      spriteAxisX: 0,
      spriteAxisY: 0,
      cameraX: 0,
      cameraY: -110,
      deltaX: 2,
      deltaY: 2,
    }).y).toBe(0);
  });

  it('converts the WebMUGEN camera left/top into the Stage DEF camera origin', () => {
    expect(resolveStageCameraPosition({ viewportWidth: 400, zOffset: 220, cameraX: 280, cameraY: 65 }))
      .toEqual({ x: 0, y: 0 });
    expect(resolveStageCameraPosition({ viewportWidth: 320, zOffset: 220, cameraX: 320, cameraY: 65 }))
      .toEqual({ x: 0, y: 0 });
  });

  it('applies sprite axes and camera delta in stage-definition coordinates', () => {
    expect(resolveStageLayerPosition({
      viewportWidth: 640,
      startX: -640,
      startY: -220,
      spriteAxisX: 0,
      spriteAxisY: -484,
      cameraX: 10,
      cameraY: -5,
      deltaX: 2,
      deltaY: 2,
    })).toEqual({ x: -340, y: 274 });
  });

  it('places the bundled Hi-Res beach at the visible floor instead of below the viewport', () => {
    expect(resolveStageLayerPosition({
      viewportWidth: 800,
      startX: -640,
      startY: -220,
      spriteAxisX: 0,
      spriteAxisY: -484,
      cameraX: 0,
      cameraY: 0,
      deltaX: 2,
      deltaY: 2,
    })).toEqual({ x: -240, y: 264 });
  });
});
