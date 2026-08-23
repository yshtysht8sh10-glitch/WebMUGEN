import { describe, expect, it, vi } from 'vitest';
import { ImageDataSpriteRenderer } from './ImageDataSpriteRenderer';
import type { ImageDataSpritePack } from '../../core/sprite/ImageDataSpriteTypes';
import { createAfterImageState } from '../../core/afterimage/AfterImageSystem';

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

  it('renders an AfterImage with per-channel palette arithmetic', () => {
    const putImageData = vi.fn();
    const createImageData = vi.fn(() => ({
      width: 1,
      height: 1,
      data: new Uint8ClampedArray(4),
      colorSpace: 'srgb',
    } as ImageData));
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ putImageData, createImageData }),
    } as unknown as HTMLCanvasElement;
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      value: { createElement: vi.fn(() => canvas) },
      configurable: true,
    });
    const pack: ImageDataSpritePack = {
      sprites: new Map([['0,0', {
        groupNo: 0,
        imageNo: 0,
        xAxis: 0,
        yAxis: 0,
        imageData: {
          width: 1,
          height: 1,
          data: new Uint8ClampedArray([200, 120, 80, 255]),
          colorSpace: 'srgb',
        } as ImageData,
      }]]),
    };
    const palette = createAfterImageState(-1, {
      palette: {
        color: 256,
        invertAll: false,
        bright: { red: 0, green: -250, blue: -250 },
        contrast: { red: 120, green: 120, blue: 220 },
        postBright: { red: 0, green: 0, blue: 0 },
        add: { red: 0, green: -250, blue: -250 },
        multiply: { red: 0.65, green: 0.65, blue: 0.75 },
      },
    }).palette;

    new ImageDataSpriteRenderer().resolveCanvas(pack, 0, 0, false, true, undefined, { palette, historyIndex: 1 });

    expect(Array.from(putImageData.mock.calls[0][0].data)).toEqual([61, 0, 0, 255]);
    Object.defineProperty(globalThis, 'document', { value: originalDocument, configurable: true });
  });
});
