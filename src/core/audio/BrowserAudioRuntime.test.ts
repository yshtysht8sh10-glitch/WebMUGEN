import { describe, expect, it, vi } from 'vitest';
import { BrowserAudioRuntime, type AudioAdapter, type AudioPlaybackHandle } from './BrowserAudioRuntime';

describe('BrowserAudioRuntime', () => {
  it('creates one adapter, unlocks once, caches decode by sample key, and plays after unlock', async () => {
    const fake = createFakeAdapter();
    const factory = vi.fn(() => fake.adapter);
    const runtime = new BrowserAudioRuntime(factory);

    expect(await runtime.playSample('1,2', new Uint8Array([1]))).toBe(false);
    expect(await runtime.unlock()).toBe(true);
    expect(await runtime.playSample('1,2', new Uint8Array([1]))).toBe(true);
    expect(await runtime.playSample('1,2', new Uint8Array([1]))).toBe(true);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(fake.resume).toHaveBeenCalledTimes(1);
    expect(fake.decode).toHaveBeenCalledTimes(1);
    expect(fake.play).toHaveBeenCalledTimes(2);
  });

  it('applies mute/master gain and stops/cleans up active sources', async () => {
    const fake = createFakeAdapter();
    const runtime = new BrowserAudioRuntime(() => fake.adapter);
    await runtime.unlock();
    runtime.setMasterVolume(0.4);
    runtime.setMuted(true);
    runtime.setMuted(false);
    await runtime.playSample('0,0', new Uint8Array([1]));
    runtime.stopAll();
    await runtime.cleanup();

    expect(fake.gains).toEqual([1, 0.4, 0, 0.4]);
    expect(fake.stop).toHaveBeenCalledTimes(1);
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it('replaces only the matching owner channel and leaves channel-less voices independent', async () => {
    const fake = createFakeAdapter();
    const runtime = new BrowserAudioRuntime(() => fake.adapter);
    await runtime.unlock();
    await runtime.playSample('p1:0,0', new Uint8Array([1]), { channelKey: 'p1:0' });
    await runtime.playSample('p2:0,0', new Uint8Array([1]), { channelKey: 'p2:0' });
    await runtime.playSample('p1:0,0', new Uint8Array([1]), { channelKey: 'p1:0' });
    await runtime.playSample('p1:0,0', new Uint8Array([1]));

    expect(fake.stop).toHaveBeenCalledTimes(1);
    expect(fake.play).toHaveBeenCalledTimes(4);
  });

  it('stops only a matching channel, cleans its table entry, and treats ended/missing channels as no-op', async () => {
    const fake = createFakeAdapter();
    const runtime = new BrowserAudioRuntime(() => fake.adapter);
    await runtime.unlock();
    await runtime.playSample('p1:0,0', new Uint8Array([1]), { channelKey: 'p1:2', loop: true });
    await runtime.playSample('p2:0,0', new Uint8Array([1]), { channelKey: 'p2:2' });

    expect(runtime.stopChannel('p1:2')).toBe(true);
    expect(runtime.stopChannel('p1:2')).toBe(false);
    expect(runtime.stopChannel('p2:2')).toBe(true);

    await runtime.playSample('p1:0,0', new Uint8Array([1]), { channelKey: 'p1:3' });
    fake.endedCallbacks[fake.endedCallbacks.length - 1]?.();
    expect(runtime.stopChannel('p1:3')).toBe(false);
  });

  it('updates only the current matching channel pan and reports missing or unsupported handles', async () => {
    const fake = createFakeAdapter();
    const runtime = new BrowserAudioRuntime(() => fake.adapter);
    await runtime.unlock();
    await runtime.playSample('p1:0,0', new Uint8Array([1]), { channelKey: 'p1:2', loop: true });
    await runtime.playSample('p2:0,0', new Uint8Array([1]), { channelKey: 'p2:2' });

    expect(runtime.updateChannelPan('p1:2', 2)).toBe('updated');
    expect(runtime.updateChannelPan('p2:2', -0.4)).toBe('updated');
    expect(runtime.updateChannelPan('p1:9', 0)).toBe('channel_not_found');
    expect(fake.pans).toEqual([1, -0.4]);

    const unsupported = createFakeAdapter(false);
    const unsupportedRuntime = new BrowserAudioRuntime(() => unsupported.adapter);
    await unsupportedRuntime.unlock();
    await unsupportedRuntime.playSample('p1:0,0', new Uint8Array([1]), { channelKey: 'p1:2' });
    expect(unsupportedRuntime.updateChannelPan('p1:2', 0.5)).toBe('unsupported');
  });

  it('updates only the replacement voice and removes naturally ended channels from pan lookup', async () => {
    const fake = createFakeAdapter();
    const runtime = new BrowserAudioRuntime(() => fake.adapter);
    await runtime.unlock();
    await runtime.playSample('old', new Uint8Array([1]), { channelKey: 'p1:3' });
    await runtime.playSample('new', new Uint8Array([2]), { channelKey: 'p1:3' });
    expect(runtime.updateChannelPan('p1:3', 0.25)).toBe('updated');
    expect(fake.pans).toEqual([0.25]);
    fake.endedCallbacks[fake.endedCallbacks.length - 1]?.();
    expect(runtime.updateChannelPan('p1:3', 0)).toBe('channel_not_found');
  });

  it('safely reports unsupported, resume rejection, and decode failure', async () => {
    const diagnostics: string[] = [];
    const unsupported = new BrowserAudioRuntime(() => null, (item) => diagnostics.push(item.code));
    expect(await unsupported.unlock()).toBe(false);

    const rejected = createFakeAdapter();
    rejected.resume.mockRejectedValueOnce(new Error('gesture required'));
    expect(await new BrowserAudioRuntime(() => rejected.adapter, (item) => diagnostics.push(item.code)).unlock()).toBe(false);

    const failed = createFakeAdapter();
    failed.decode.mockRejectedValueOnce(new Error('bad wav'));
    const runtime = new BrowserAudioRuntime(() => failed.adapter, (item) => diagnostics.push(item.code));
    await runtime.unlock();
    expect(await runtime.playSample('bad', new Uint8Array([0]))).toBe(false);

    expect(diagnostics).toEqual(expect.arrayContaining(['audio_unsupported', 'audio_locked', 'decode_failed']));
  });
});

function createFakeAdapter(supportsPan = true) {
  const stop = vi.fn();
  const resume = vi.fn(async () => {});
  const decode = vi.fn(async () => ({ decoded: true }));
  const endedCallbacks: Array<() => void> = [];
  const pans: number[] = [];
  const play = vi.fn((): AudioPlaybackHandle => ({
    stop,
    setOnEnded(callback) { endedCallbacks.push(callback); },
    ...(supportsPan ? { setPan(value: number) { pans.push(value); return true; } } : {}),
  }));
  const close = vi.fn(async () => {});
  const gains: number[] = [];
  const adapter: AudioAdapter = {
    state: 'suspended', resume, decode, play,
    setMasterGain(value) { gains.push(value); },
    close,
  };
  return { adapter, stop, resume, decode, play, close, gains, endedCallbacks, pans };
}
