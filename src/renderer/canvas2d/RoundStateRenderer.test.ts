import { describe, expect, it } from 'vitest';
import { createInitialRoundScore } from '../../core/engine/RoundScore';
import { createInitialRoundState } from '../../core/engine/RoundState';
import { RoundStateRenderer } from './RoundStateRenderer';

describe('RoundStateRenderer', () => {
  it('renders timer without throwing', () => {
    const calls: string[] = [];
    const ctx = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      fillRect: () => calls.push('fillRect'),
      fillText: (text: string) => calls.push(text),
      set fillStyle(_value: string) {},
      set font(_value: string) {},
    } as unknown as CanvasRenderingContext2D;

    new RoundStateRenderer().render(ctx, createInitialRoundState());

    expect(calls).toContain('99');
    expect(calls).toContain('ROUND 1');
  });

  it('renders score HUD', () => {
    const calls: Array<string | [number, number, number, number]> = [];
    const ctx = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      fillRect: (x: number, y: number, width: number, height: number) => calls.push([x, y, width, height]),
      fillText: (text: string) => calls.push(text),
      set fillStyle(_value: string) {},
      set font(_value: string) {},
    } as unknown as CanvasRenderingContext2D;

    new RoundStateRenderer().render(ctx, createInitialRoundState(), {
      ...createInitialRoundScore(),
      p1Wins: 2,
      p2Wins: 1,
    }, 960, 'cyber');

    expect(calls).toContain('P1 WINS 2');
    expect(calls).toContain('P2 WINS 1');
    expect(calls).toContainEqual([180, 50, 120, 18]);
    expect(calls).toContainEqual([660, 50, 120, 18]);
  });

  it('centers the timer for 640, 800, and 960 pixel HUD viewports', () => {
    const positions: number[] = [];
    const ctx = {
      save: () => undefined,
      restore: () => undefined,
      fillRect: () => undefined,
      strokeRect: () => undefined,
      fillText: (text: string, x: number) => { if (text === '99') positions.push(x); },
      set fillStyle(_value: string) {},
      set strokeStyle(_value: string) {},
      set font(_value: string) {},
      set textAlign(_value: string) {},
      set textBaseline(_value: string) {},
    } as unknown as CanvasRenderingContext2D;

    new RoundStateRenderer().render(ctx, createInitialRoundState(), undefined, 640);
    new RoundStateRenderer().render(ctx, createInitialRoundState(), undefined, 800);
    new RoundStateRenderer().render(ctx, createInitialRoundState(), undefined, 960);

    expect(positions).toEqual([320, 400, 480]);
  });

  it('does not cover the character Intro with ROUND or FIGHT presentation', () => {
    const calls: string[] = [];
    const ctx = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      fillRect: () => calls.push('fillRect'),
      fillText: (text: string) => calls.push(text),
      set fillStyle(_value: string) {},
      set font(_value: string) {},
    } as unknown as CanvasRenderingContext2D;

    new RoundStateRenderer().render(ctx, createInitialRoundState());

    expect(calls.filter((text) => text === 'ROUND 1')).toHaveLength(1);
    expect(calls).not.toContain('FIGHT!');
  });

  it('renders ROUND then FIGHT after the character Intro', () => {
    const calls: string[] = [];
    const ctx = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      fillRect: () => calls.push('fillRect'),
      fillText: (text: string) => calls.push(text),
      set fillStyle(_value: string) {},
      set font(_value: string) {},
    } as unknown as CanvasRenderingContext2D;

    new RoundStateRenderer().render(ctx, {
      ...createInitialRoundState(),
      introPresentationFrame: 0,
    });
    expect(calls.filter((text) => text === 'ROUND 1')).toHaveLength(2);

    calls.length = 0;
    new RoundStateRenderer().render(ctx, {
      ...createInitialRoundState(),
      introPresentationFrame: 45,
    });

    expect(calls).toContain('FIGHT!');
  });

  it('keeps FIGHT out of the behind-player HUD pass and in the foreground presentation pass', () => {
    const calls: string[] = [];
    const ctx = {
      save: () => undefined,
      restore: () => undefined,
      fillRect: () => undefined,
      strokeRect: () => undefined,
      fillText: (text: string) => calls.push(text),
      set fillStyle(_value: string) {},
      set strokeStyle(_value: string) {},
      set font(_value: string) {},
      set textAlign(_value: string) {},
      set textBaseline(_value: string) {},
    } as unknown as CanvasRenderingContext2D;
    const round = { ...createInitialRoundState(), introPresentationFrame: 45 };

    const renderer = new RoundStateRenderer();
    renderer.renderHud(ctx, round);
    expect(calls).not.toContain('FIGHT!');

    renderer.renderPresentation(ctx, round);
    expect(calls).toContain('FIGHT!');
  });

  it('renders KO restart prompt', () => {
    const calls: string[] = [];
    const ctx = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      fillRect: () => calls.push('fillRect'),
      fillText: (text: string) => calls.push(text),
      set fillStyle(_value: string) {},
      set font(_value: string) {},
    } as unknown as CanvasRenderingContext2D;

    new RoundStateRenderer().render(ctx, {
      ...createInitialRoundState(),
      phase: 'ko',
      winner: 1,
    });

    expect(calls).toContain('K.O.');
    expect(calls).toContain('P1 WINS');
    expect(calls).toContain('PRESS R TO RESTART');
  });
});
