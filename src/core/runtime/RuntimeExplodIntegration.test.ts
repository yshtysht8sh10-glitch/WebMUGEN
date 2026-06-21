import { describe, expect, it } from 'vitest';
import { createInitialExplodState } from '../explod/ExplodSystem';
import { applyExplodRuntimeEvents } from './RuntimeExplodIntegration';

describe('Phase64 RuntimeExplodIntegration', () => {
  it('applies explod and removeExplod events', () => {
    const owner = { x: 100, y: 360, facing: 1 as const };
    const added = applyExplodRuntimeEvents(createInitialExplodState(), [
      { type: 'explod', id: 10, animNo: 9000, x: 5, y: -20, removeTime: 30 },
    ], owner);

    expect(added.explods[0]).toMatchObject({ id: 10, animNo: 9000, x: 105, y: 340 });

    const removed = applyExplodRuntimeEvents(added, [{ type: 'removeExplod', id: 10 }], owner);
    expect(removed.explods).toHaveLength(0);
  });
});
