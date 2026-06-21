import { describe, expect, it } from 'vitest';
import { createInitialPauseState } from '../pause/PauseSystem';
import { applyPauseRuntimeEvents } from './RuntimePauseIntegration';

describe('Phase63 RuntimePauseIntegration', () => {
  it('applies pause and superpause events', () => {
    const state = applyPauseRuntimeEvents(createInitialPauseState(), [
      { type: 'pause', time: 5, moveTime: 1 },
      { type: 'superpause', time: 30, moveTime: 4, darken: false },
    ]);

    expect(state.pauseTime).toBe(5);
    expect(state.superPauseTime).toBe(30);
    expect(state.moveTime).toBe(4);
    expect(state.darken).toBe(false);
  });
});
