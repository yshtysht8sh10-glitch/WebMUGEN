import { describe, expect, it } from 'vitest';
import { HitFeedbackRenderer } from './HitFeedbackRenderer';

describe('HitFeedbackRenderer', () => {
  it('renders hit sparks without throwing', () => {
    const calls: string[] = [];
    const ctx = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      translate: () => calls.push('translate'),
      beginPath: () => calls.push('beginPath'),
      arc: () => calls.push('arc'),
      fill: () => calls.push('fill'),
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      stroke: () => calls.push('stroke'),
      fillText: () => calls.push('fillText'),
      set fillStyle(_value: string) {},
      set strokeStyle(_value: string) {},
      set lineWidth(_value: number) {},
      set font(_value: string) {},
    } as unknown as CanvasRenderingContext2D;

    new HitFeedbackRenderer().render(ctx, {
      nextSparkId: 2,
      sparks: [{ id: 1, x: 100, y: 120, life: 18, attackerId: 1, defenderId: 2, damage: 60 }],
    });

    expect(calls).toContain('fillText');
    expect(calls).toContain('stroke');
  });
});
