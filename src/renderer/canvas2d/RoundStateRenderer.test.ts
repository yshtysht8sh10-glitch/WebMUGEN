import { describe, expect, it } from 'vitest';
import { createInitialRoundState } from '../../core/engine/RoundState';
import { RoundStateRenderer } from './RoundStateRenderer';

describe('RoundStateRenderer', () => {
  it('renders timer without throwing', () => {
    const calls: string[] = [];
    const ctx = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      fillRect: () => calls.push('fillRect'),
      fillText: () => calls.push('fillText'),
      set fillStyle(_value: string) {},
      set font(_value: string) {},
    } as unknown as CanvasRenderingContext2D;

    new RoundStateRenderer().render(ctx, createInitialRoundState());

    expect(calls).toContain('fillText');
  });

  it('renders KO text', () => {
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
  });
});
