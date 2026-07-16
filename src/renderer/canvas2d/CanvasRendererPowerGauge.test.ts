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

    expect(fillRect).toHaveBeenCalledWith(20, 342, 130, 8);
    expect(fillRect).toHaveBeenCalledWith(555, 342, 65, 8);
    expect(firstDiagnostics).toContain('raw.power_hud p1=4500/9000 width=130 p2=2250/9000 width=65 infinite=off');
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

    expect(fillText).toHaveBeenCalledWith('∞', 284, 350);
    expect(fillText).toHaveBeenCalledWith('∞', 344, 350);
    expect(diagnostics).toContain('raw.power_hud p1=9000/9000 width=260 p2=9000/9000 width=260 infinite=both');
  });
});
