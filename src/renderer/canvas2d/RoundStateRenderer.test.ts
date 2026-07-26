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
    }, 960);

    expect(calls).toContain('P1 WINS 2');
    expect(calls).toContain('P2 WINS 1');
    expect(calls).toContainEqual([180, 38, 120, 20]);
    expect(calls).toContainEqual([660, 38, 120, 20]);
  });

  it('renders FIGHT during late intro', () => {
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
      frameInPhase: 45,
    });

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
