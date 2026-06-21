import { describe, expect, it } from 'vitest';
import {
  canPlayerMoveDuringPause,
  createInitialPauseState,
  isGamePaused,
  startPause,
  startSuperPause,
  stepPauseState,
} from './PauseSystem';

describe('Phase57 PauseSystem', () => {
  it('starts and steps normal pause', () => {
    const paused = startPause(createInitialPauseState(), 2);
    expect(isGamePaused(paused)).toBe(true);

    const once = stepPauseState(paused);
    expect(once.pauseTime).toBe(1);

    const twice = stepPauseState(once);
    expect(isGamePaused(twice)).toBe(false);
  });

  it('starts super pause with darken and movetime', () => {
    const paused = startSuperPause(createInitialPauseState(), 3, { darken: true, moveTime: 2 });
    expect(paused.superPauseTime).toBe(3);
    expect(paused.darken).toBe(true);
    expect(canPlayerMoveDuringPause(paused)).toBe(true);

    const stepped = stepPauseState(stepPauseState(paused));
    expect(stepped.moveTime).toBe(0);
    expect(stepped.superPauseTime).toBe(1);
  });
});
