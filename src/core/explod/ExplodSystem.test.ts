import { describe, expect, it } from 'vitest';
import { addExplod, createInitialExplodState, removeExplod, stepExplods } from './ExplodSystem';

describe('Phase53 ExplodSystem', () => {
  it('adds, steps, expires, and removes explods', () => {
    const state = addExplod(createInitialExplodState(), { animNo: 9000, x: 10, y: 20, facing: 1, removeTime: 2 });
    expect(state.explods[0].id).toBe(1);
    expect(stepExplods(state).explods[0].age).toBe(1);
    expect(stepExplods(stepExplods(state)).explods).toHaveLength(0);

    const persistent = addExplod(createInitialExplodState(), { id: 10, animNo: 1, x: 0, y: 0, facing: -1, removeTime: null });
    expect(removeExplod(persistent, 10).explods).toHaveLength(0);
  });
});
