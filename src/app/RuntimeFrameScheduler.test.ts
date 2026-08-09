import { describe, expect, it } from 'vitest';
import { resolveRuntimeFrameTick } from './RuntimeFrameScheduler';

describe('resolveRuntimeFrameTick', () => {
  it('does not drop 60 Hz RAF timestamps to every other frame', () => {
    const interval = 1000 / 60;
    const tick = resolveRuntimeFrameTick(0, 16.666, interval);
    expect(tick.advance).toBe(true);
  });

  it('carries the schedule forward instead of discarding fractional backlog', () => {
    const first = resolveRuntimeFrameTick(0, 16.7, 20);
    expect(first.advance).toBe(false);
    const second = resolveRuntimeFrameTick(first.nextTickTime, 33.4, 20);
    expect(second).toMatchObject({ advance: true, nextTickTime: 20 });
    const third = resolveRuntimeFrameTick(second.nextTickTime, 50.1, 20);
    expect(third).toMatchObject({ advance: true, nextTickTime: 40 });
  });

  it('resynchronizes after a long inactive gap', () => {
    expect(resolveRuntimeFrameTick(10, 1000, 20).nextTickTime).toBe(1000);
  });
});
