import { describe, expect, it } from 'vitest';
import { addTarget, createInitialTargetState, dropTargets, getTargets, hasTarget, stepTargets } from './TargetSystem';

describe('Phase59 TargetSystem', () => {
  it('adds and drops targets', () => {
    const state = addTarget(createInitialTargetState(), 1, 2, 3);
    expect(hasTarget(state, 1)).toBe(true);
    expect(getTargets(state, 1)[0]).toMatchObject({ ownerId: 1, targetId: 2, hitId: 1 });

    const dropped = dropTargets(state, 1);
    expect(hasTarget(dropped, 1)).toBe(false);
  });

  it('steps bind time and expires links', () => {
    const state = addTarget(createInitialTargetState(), 1, 2, 1);
    expect(stepTargets(state).links).toHaveLength(0);
  });
});
