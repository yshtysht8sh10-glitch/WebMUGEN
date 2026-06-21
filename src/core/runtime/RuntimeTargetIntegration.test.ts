import { describe, expect, it } from 'vitest';
import { createInitialTargetState, hasTarget } from '../target/TargetSystem';
import { applyTargetRuntimeEvents } from './RuntimeTargetIntegration';

describe('Phase66 RuntimeTargetIntegration', () => {
  it('applies target bind and target drop events', () => {
    const bound = applyTargetRuntimeEvents(createInitialTargetState(), [
      { type: 'targetBind', ownerId: 1, targetId: 2, time: 5, x: 0, y: 0 },
    ]);

    expect(hasTarget(bound, 1)).toBe(true);

    const dropped = applyTargetRuntimeEvents(bound, [{ type: 'targetDrop', ownerId: 1 }]);
    expect(hasTarget(dropped, 1)).toBe(false);
  });
});
