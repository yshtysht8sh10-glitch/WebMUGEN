import { describe, expect, it, vi } from 'vitest';
import { BrowserAudioRuntime, type AudioAdapter } from '../core/audio/BrowserAudioRuntime';
import { installAudioGestureUnlock } from './AudioGestureUnlock';

describe('app audio gesture unlock lifecycle', () => {
  it('shares the first key/pointer unlock, removes both listeners on success, and does not depend on runtime tabs', async () => {
    let resolveResume!: () => void;
    const resume = vi.fn(() => new Promise<void>((resolve) => { resolveResume = resolve; }));
    const runtime = new BrowserAudioRuntime((): AudioAdapter => ({
      state: 'suspended', resume,
      async decode() { return {}; },
      play() { return { stop() {} }; },
      setMasterGain() {},
      async close() {},
    }));
    const target = new FakeGestureTarget();
    const statuses: string[] = [];
    const cleanup = installAudioGestureUnlock(target, runtime, (status) => statuses.push(status));

    expect(target.listenerCount('keydown')).toBe(1);
    expect(target.listenerCount('pointerdown')).toBe(1);
    target.dispatch('keydown');
    target.dispatch('pointerdown');
    expect(resume).toHaveBeenCalledTimes(1);

    resolveResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toEqual(['unlocked', 'unlocked']);
    expect(target.listenerCount('keydown')).toBe(0);
    expect(target.listenerCount('pointerdown')).toBe(0);
    cleanup();
  });

  it('keeps listeners for a rejected resume retry and suppresses stale status after cleanup', async () => {
    const resume = vi.fn()
      .mockRejectedValueOnce(new Error('gesture rejected'))
      .mockResolvedValueOnce(undefined);
    const runtime = new BrowserAudioRuntime((): AudioAdapter => ({
      state: 'suspended', resume,
      async decode() { return {}; },
      play() { return { stop() {} }; },
      setMasterGain() {},
      async close() {},
    }));
    const target = new FakeGestureTarget();
    const statuses: string[] = [];
    const cleanup = installAudioGestureUnlock(target, runtime, (status) => statuses.push(status));

    target.dispatch('keydown');
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toEqual(['locked']);
    expect(target.listenerCount('keydown')).toBe(1);

    target.dispatch('pointerdown');
    cleanup();
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toEqual(['locked']);
    expect(resume).toHaveBeenCalledTimes(2);
    expect(target.listenerCount('keydown')).toBe(0);
    expect(target.listenerCount('pointerdown')).toBe(0);
  });
});

class FakeGestureTarget {
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: 'pointerdown' | 'keydown', listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: 'pointerdown' | 'keydown', listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: 'pointerdown' | 'keydown'): void {
    for (const listener of this.listeners.get(type) ?? []) listener(new Event(type));
  }

  listenerCount(type: 'pointerdown' | 'keydown'): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}
