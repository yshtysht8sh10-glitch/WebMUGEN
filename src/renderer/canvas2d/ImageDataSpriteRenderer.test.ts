import { describe, expect, it, vi } from 'vitest';
import { ImageDataSpriteRenderer } from './ImageDataSpriteRenderer';
import type { ImageDataSpritePack } from '../../core/sprite/ImageDataSpriteTypes';

describe('ImageDataSpriteRenderer', () => {
  it('creates canvas from ImageDataSpritePack and caches it', () => {
    const putImageData = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ putImageData }),
    } as unknown as HTMLCanvasElement;

    const originalDocument = globalThis.document;

    Object.defineProperty(globalThis, 'document', {
      value: {
        createElement: vi.fn(() => canvas),
      },
      configurable: true,
    });

    const pack: ImageDataSpritePack = {
      sprites: new Map([
        [
          '200,2',
          {
            groupNo: 200,
            imageNo: 2,
            xAxis: 16,
            yAxis: 78,
            imageData: {
              width: 2,
              height: 1,
              data: new Uint8ClampedArray(8),
              colorSpace: 'srgb',
            } as ImageData,
          },
        ],
      ]),
    };

    const renderer = new ImageDataSpriteRenderer();
    const first = renderer.findCanvas(pack, 200, 2);
    const second = renderer.findCanvas(pack, 200, 2);

    expect(first).toBe(canvas);
    expect(second).toBe(canvas);
    expect(canvas.width).toBe(2);
    expect(canvas.height).toBe(1);
    expect(putImageData).toHaveBeenCalledTimes(1);
    expect(globalThis.document.createElement).toHaveBeenCalledTimes(1);

    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      configurable: true,
    });
  });

  it('returns undefined for missing sprite', () => {
    const renderer = new ImageDataSpriteRenderer();

    expect(renderer.findCanvas({ sprites: new Map() }, 1, 1)).toBeUndefined();
  });
});