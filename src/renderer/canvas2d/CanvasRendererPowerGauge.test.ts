import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../../core/engine/GameState';
import { CanvasRenderer } from './CanvasRenderer';

describe('Issue #52 Canvas power gauge', () => {
  it('draws power / powerMax for both players and reports changes once', () => {
    const fillRect = vi.fn();
    const context = {
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), fillRect, strokeRect: vi.fn(),
      beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), fillText: vi.fn(), scale: vi.fn(), drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const state = createInitialGameState(9000);
    state.players = [{ ...state.players[0], power: 4500 }, { ...state.players[1], power: 2250 }];
    const renderer = new CanvasRenderer(canvas);

    const firstDiagnostics = renderer.render(state);
    const unchangedDiagnostics = renderer.render(state);

    expect(fillRect).toHaveBeenCalledWith(20, 37, 65, 8);
    expect(fillRect).toHaveBeenCalledWith(587.5, 37, 32.5, 8);
    expect(firstDiagnostics).toContain('raw.power_hud p1=4500/9000 width=65 p2=2250/9000 width=32.5 infinite=off');
    expect(unchangedDiagnostics.some((line) => line.startsWith('raw.power_hud'))).toBe(false);
  });

  it('marks selected gauges as infinite without replacing their real powerMax', () => {
    const fillText = vi.fn();
    const context = {
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
      beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), fillText, scale: vi.fn(), drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const state = createInitialGameState(9000);
    state.players = [
      { ...state.players[0], power: 9000, infinitePower: true },
      { ...state.players[1], power: 9000, infinitePower: true },
    ];

    const diagnostics = new CanvasRenderer(canvas).render(state);

    expect(fillText).toHaveBeenCalledWith('∞', 154, 45);
    expect(fillText).toHaveBeenCalledWith('∞', 476, 45);
    expect(diagnostics).toContain('raw.power_hud p1=9000/9000 width=130 p2=9000/9000 width=130 infinite=both');
  });

  it('centers both gauges symmetrically in the 960px app canvas', () => {
    const fillRect = vi.fn();
    const context = {
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), fillRect, strokeRect: vi.fn(),
      beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), fillText: vi.fn(), scale: vi.fn(), drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 960, height: 540, getContext: () => context } as unknown as HTMLCanvasElement;

    new CanvasRenderer(canvas).render(createInitialGameState());

    expect(fillRect).toHaveBeenCalledWith(178, 14, 264, 20);
    expect(fillRect).toHaveBeenCalledWith(518, 14, 264, 20);
    expect(fillRect).toHaveBeenCalledWith(178, 35, 134, 12);
    expect(fillRect).toHaveBeenCalledWith(648, 35, 134, 12);
  });

  it('centers the classic 640px HUD inside the extended 800px canvas', () => {
    const fillRect = vi.fn();
    const context = {
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), fillRect, strokeRect: vi.fn(),
      beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), fillText: vi.fn(), scale: vi.fn(), drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 800, height: 480, getContext: () => context } as unknown as HTMLCanvasElement;

    new CanvasRenderer(canvas).render(createInitialGameState());

    expect(fillRect).toHaveBeenCalledWith(98, 14, 264, 20);
    expect(fillRect).toHaveBeenCalledWith(438, 14, 264, 20);
    expect(fillRect).toHaveBeenCalledWith(98, 35, 134, 12);
    expect(fillRect).toHaveBeenCalledWith(568, 35, 134, 12);
  });

  it('suppresses life, power, and round HUD drawing when the system HUD toggle is off', () => {
    const fillRect = vi.fn();
    const context = {
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), fillRect, strokeRect: vi.fn(),
      beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), fillText: vi.fn(), scale: vi.fn(), drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 960, height: 540, getContext: () => context } as unknown as HTMLCanvasElement;

    new CanvasRenderer(canvas).render(createInitialGameState(), undefined, undefined, undefined, { hudVisible: false });

    expect(fillRect).not.toHaveBeenCalledWith(180, 18, 260, 16);
    expect(fillRect).not.toHaveBeenCalledWith(180, 37, 130, 8);
  });

  it('draws the HUD before character sprites so gauges stay behind', () => {
    const calls: string[] = [];
    const context = {
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(),
      fillRect: (x: number, y: number) => calls.push(x === 18 && y === 14 ? 'hud' : x < 0 || y < 0 ? 'character' : 'world'),
      strokeRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(),
      fillText: vi.fn(), scale: vi.fn(), drawImage: () => calls.push('sprite'),
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;

    new CanvasRenderer(canvas).render(createInitialGameState());

    expect(calls.indexOf('hud')).toBeGreaterThanOrEqual(0);
    expect(calls.lastIndexOf('character')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('hud')).toBeLessThan(calls.lastIndexOf('character'));
  });
});
