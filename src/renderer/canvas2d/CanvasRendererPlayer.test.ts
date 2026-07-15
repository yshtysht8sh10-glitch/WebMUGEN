import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../../core/engine/GameState';
import type { AirDocument } from '../../parser/air/AirTypes';
import type { SpritePack } from '../../core/sprite/SpriteTypes';
import { CanvasRenderer } from './CanvasRenderer';

describe('CanvasRenderer player sprite fallback', () => {
  it('renders nothing when AIR intentionally references a missing SFF sprite', () => {
    const fillRect = vi.fn();
    const ellipse = vi.fn();
    const context = fakeContext(fillRect, ellipse);
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const missingSprites: SpritePack = { sprites: new Map() };
    const assets = { airDocument: air(0, 9999, 0), spritePack: missingSprites };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets });

    renderer.render(createInitialGameState());

    expect(fillRect).not.toHaveBeenCalledWith(-16, -58, 32, 58);
    expect(ellipse).not.toHaveBeenCalledWith(expect.any(Number), 305, 32, 8, 0, 0, Math.PI * 2);
  });

  it('keeps the debug fallback when no SFF asset was loaded at all', () => {
    const fillRect = vi.fn();
    const context = fakeContext(fillRect, vi.fn());
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const renderer = new CanvasRenderer(canvas, air(0, 9999, 0));

    renderer.render(createInitialGameState());

    expect(fillRect).toHaveBeenCalledWith(-16, -58, 32, 58);
  });
});

function fakeContext(fillRect: ReturnType<typeof vi.fn>, ellipse: ReturnType<typeof vi.fn>): CanvasRenderingContext2D {
  return {
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
    fillRect, strokeRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), ellipse, fill: vi.fn(),
    fillText: vi.fn(), drawImage: vi.fn(), strokeStyle: '', fillStyle: '', font: '',
  } as unknown as CanvasRenderingContext2D;
}

function air(actionNo: number, groupNo: number, imageNo: number): AirDocument {
  return {
    actions: [{
      actionNo,
      elements: [{ groupNo, imageNo, offsetX: 0, offsetY: 0, duration: 3, clsn1: [], clsn2: [] }],
      defaultClsn1: [],
      defaultClsn2: [],
    }],
  };
}
