import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseWebMugenStage } from './WebMugenStageLoader';
import { WebMugenStageRenderer } from './WebMugenStageRenderer';

class LoadedImage {
  complete = true;
  naturalWidth = 1920;
  naturalHeight = 1080;
  onerror: (() => void) | null = null;
  src = '';
}

afterEach(() => vi.unstubAllGlobals());

describe('WebMugenStageRenderer layered image passes', () => {
  it('draws sorted background layers with independent X/Y camera factors and foreground separately', () => {
    vi.stubGlobal('Image', LoadedImage);
    const stage = parseWebMugenStage(
      JSON.parse(readFileSync(resolve('public/stages/webmugen/cyber-clasic/stage.json'), 'utf8')),
      '/stages/webmugen/cyber-clasic/stage.json',
    );
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const context = {
      ctx: { drawImage, fillRect, fillStyle: '' } as unknown as CanvasRenderingContext2D,
      viewportWidth: 800,
      viewportHeight: 480,
      cameraX: 100,
      cameraY: 50,
    };
    const renderer = new WebMugenStageRenderer();

    renderer.render(stage, context);
    expect(drawImage.mock.calls.map((call) => (call[0] as LoadedImage).src)).toEqual([
      '/stages/webmugen/cyber-clasic/sky.webp',
      '/stages/webmugen/cyber-clasic/background.webp',
      '/stages/webmugen/cyber-clasic/floor.webp',
    ]);
    const backgroundPositions = drawImage.mock.calls.map((call) => [call[1], call[2]]);
    expect(backgroundPositions[0][0]).toBeGreaterThan(backgroundPositions[1][0]);
    expect(backgroundPositions[1][0]).toBeGreaterThan(backgroundPositions[2][0]);
    expect(backgroundPositions[0][1]).toBeGreaterThan(backgroundPositions[2][1]);
    expect(fillRect).not.toHaveBeenCalled();

    drawImage.mockClear();
    renderer.renderForeground(stage, context);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect((drawImage.mock.calls[0][0] as LoadedImage).src).toBe('/stages/webmugen/cyber-clasic/front.png');
  });

  it('uses a solid fallback only for an unavailable background pass', () => {
    vi.stubGlobal('Image', undefined);
    const stage = parseWebMugenStage({
      format: 'webmugen-stage', version: 1, id: 'fallback', name: 'Fallback', presentation: 'image', groundY: 0,
      players: { p1Start: [-70, 0], p2Start: [70, 0] },
      camera: { boundLeft: -400, boundRight: 400, boundHigh: -120, boundLow: 0 },
      layers: [{ type: 'image', src: 'background.png' }, { type: 'image', src: 'front.png', pass: 'foreground' }],
    });
    const fillRect = vi.fn();
    const renderer = new WebMugenStageRenderer();
    const context = {
      ctx: { fillRect, fillStyle: '' } as unknown as CanvasRenderingContext2D,
      viewportWidth: 800, viewportHeight: 480, cameraX: 0, cameraY: 0,
    };

    renderer.render(stage, context);
    renderer.renderForeground(stage, context);
    expect(fillRect).toHaveBeenCalledTimes(1);
    expect(fillRect).toHaveBeenCalledWith(0, 0, 800, 480);
  });
});
