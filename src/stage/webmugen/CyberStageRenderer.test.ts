import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseWebMugenStage } from './WebMugenStageLoader';
import { CyberStageRenderer } from './CyberStageRenderer';

class PanoramaImage {
  complete = true;
  naturalWidth = 2172;
  naturalHeight = 724;
  onerror: (() => void) | null = null;
  src = '';
}

afterEach(() => vi.unstubAllGlobals());

describe('CyberStageRenderer', () => {
  it.each([0, 560])('keeps the panorama covering the viewport at camera X=%s', (cameraX) => {
    vi.stubGlobal('Image', PanoramaImage);
    const drawImage = vi.fn();
    new CyberStageRenderer().render(stage(), {
      ctx: context(drawImage), viewportWidth: 400, viewportHeight: 240, cameraX, cameraY: 65,
    });

    for (const call of drawImage.mock.calls) {
      const drawX = call[1] as number;
      const drawWidth = call[3] as number;
      expect(drawX).toBeLessThanOrEqual(0);
      expect(drawX + drawWidth).toBeGreaterThanOrEqual(400);
    }
  });

  it('moves the chamber slowly and locks the arena floor to the full camera delta', () => {
    vi.stubGlobal('Image', PanoramaImage);
    const initialDraw = vi.fn();
    const movedDraw = vi.fn();
    const renderer = new CyberStageRenderer();
    renderer.render(stage(), {
      ctx: context(initialDraw), viewportWidth: 400, viewportHeight: 240, cameraX: 280, cameraY: 65,
    });
    renderer.render(stage(), {
      ctx: context(movedDraw), viewportWidth: 400, viewportHeight: 240, cameraX: 330, cameraY: 65,
    });

    const firstShift = (movedDraw.mock.calls[0][1] as number) - (initialDraw.mock.calls[0][1] as number);
    const lastShift = (movedDraw.mock.calls.at(-1)![1] as number) - (initialDraw.mock.calls.at(-1)![1] as number);
    expect(firstShift).toBeCloseTo(-5);
    expect(lastShift).toBeCloseTo(-50);
  });
});

function stage() {
  return parseWebMugenStage({
    format: 'webmugen-stage', version: 1, id: 'cyber', name: 'Cyber', presentation: 'cyber', groundY: 0,
    players: { p1Start: [-70, 0], p2Start: [70, 0] },
    camera: { boundLeft: -400, boundRight: 400, boundHigh: -120, boundLow: 0, verticalFollow: 0, tension: 50 },
    layers: [{ type: 'image', src: 'background-panorama-v2.png' }],
  }, '/stages/webmugen/cyber-training/stage.json');
}

function context(drawImage: ReturnType<typeof vi.fn>): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(), clip: vi.fn(), drawImage, fillRect: vi.fn(), fillStyle: '', rect: vi.fn(), restore: vi.fn(), save: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}
