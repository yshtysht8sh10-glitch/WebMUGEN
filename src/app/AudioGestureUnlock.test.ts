import { describe, expect, it, vi } from 'vitest';
import { BrowserAudioRuntime, type AudioAdapter } from '../core/audio/BrowserAudioRuntime';
import { createAudioUserGestureUnlock, installAudioGestureUnlock } from './AudioGestureUnlock';

describe('app audio gesture unlock lifecycle', () => {
  it('shares repeated key/pointer unlock callbacks through one runtime without depending on runtime tabs', async () => {
    let resolveResume!: () => void;
    let state = 'suspended';
    const resume = vi.fn(() => new Promise<void>((resolve) => { resolveResume = () => { state = 'running'; resolve(); }; }));
    const runtime = new BrowserAudioRuntime((): AudioAdapter => ({
      get state() { return state; }, resume,
      async decode() { return {}; },
      play() { return { stop() {} }; },
      setMasterGain() {},
      async close() {},
    }));
    const target = new FakeGestureTarget();
    const statuses: string[] = [];
    const gestureUnlock = createAudioUserGestureUnlock(runtime, (status) => statuses.push(status));
    const cleanup = installAudioGestureUnlock(target, gestureUnlock.onUserGesture);

    expect(target.listenerCount('pointerdown')).toBe(1);
    gestureUnlock.onUserGesture('keydown');
    target.dispatch('pointerdown');
    expect(resume).toHaveBeenCalledTimes(1);

    resolveResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toEqual(['unlocked', 'unlocked']);
    expect(target.listenerCount('pointerdown')).toBe(1);
    cleanup();
    gestureUnlock.dispose();
    expect(target.listenerCount('pointerdown')).toBe(0);
  });

  it('keeps listeners for a rejected resume retry and suppresses stale status after cleanup', async () => {
    let state = 'suspended';
    const resume = vi.fn()
      .mockRejectedValueOnce(new Error('gesture rejected'))
      .mockImplementationOnce(async () => { state = 'running'; });
    const runtime = new BrowserAudioRuntime((): AudioAdapter => ({
      get state() { return state; }, resume,
      async decode() { return {}; },
      play() { return { stop() {} }; },
      setMasterGain() {},
      async close() {},
    }));
    const target = new FakeGestureTarget();
    const statuses: string[] = [];
    const gestureUnlock = createAudioUserGestureUnlock(runtime, (status) => statuses.push(status));
    const cleanup = installAudioGestureUnlock(target, gestureUnlock.onUserGesture);

    gestureUnlock.onUserGesture('keydown');
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toEqual(['locked']);
    expect(target.listenerCount('pointerdown')).toBe(1);

    target.dispatch('pointerdown');
    cleanup();
    gestureUnlock.dispose();
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toEqual(['locked']);
    expect(resume).toHaveBeenCalledTimes(2);
    expect(target.listenerCount('pointerdown')).toBe(0);
  });

  it('survives a StrictMode-style mount, cleanup, and remount with a fresh runtime', async () => {
    const target = new FakeGestureTarget();
    const first = createGestureRuntime();
    const firstGestureUnlock = createAudioUserGestureUnlock(first.runtime, first.onStatus);
    const firstCleanup = installAudioGestureUnlock(target, firstGestureUnlock.onUserGesture);
    firstCleanup();
    firstGestureUnlock.dispose();
    await first.runtime.cleanup();

    const second = createGestureRuntime();
    const secondGestureUnlock = createAudioUserGestureUnlock(second.runtime, second.onStatus);
    const secondCleanup = installAudioGestureUnlock(target, secondGestureUnlock.onUserGesture);
    secondGestureUnlock.onUserGesture('keydown');
    await Promise.resolve();
    await Promise.resolve();

    expect(first.statuses).toEqual([]);
    expect(first.resume).not.toHaveBeenCalled();
    expect(second.statuses).toEqual(['unlocked']);
    expect(second.resume).toHaveBeenCalledTimes(1);
    secondCleanup();
    secondGestureUnlock.dispose();
  });
});

function createGestureRuntime() {
  let state = 'suspended';
  const resume = vi.fn(async () => { state = 'running'; });
  const statuses: string[] = [];
  const runtime = new BrowserAudioRuntime((): AudioAdapter => ({
    get state() { return state; }, resume,
    async decode() { return {}; },
    play() { return { stop() {} }; },
    setMasterGain() {},
    async close() {},
  }));
  return { runtime, resume, statuses, onStatus: (status: string) => statuses.push(status) };
}

class FakeGestureTarget {
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: 'pointerdown', listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: 'pointerdown', listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: 'pointerdown'): void {
    for (const listener of this.listeners.get(type) ?? []) listener(new Event(type));
  }

  listenerCount(type: 'pointerdown'): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}
