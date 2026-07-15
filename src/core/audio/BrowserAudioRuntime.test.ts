import { describe, expect, it, vi } from 'vitest';
import { BrowserAudioRuntime, createWebAudioAdapter, formatAudioRuntimeDiagnostic, type AudioAdapter, type AudioPlaybackHandle, type AudioRuntimeDiagnostic } from './BrowserAudioRuntime';

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

  it('shares an in-flight unlock and lets the same gesture playback wait for resume', async () => {
    let resolveResume!: () => void;
    const fake = createFakeAdapter();
    fake.resume.mockImplementation(() => new Promise<void>((resolve) => { resolveResume = resolve; }));
    const factory = vi.fn(() => fake.adapter);
    const runtime = new BrowserAudioRuntime(factory);

    const firstUnlock = runtime.unlock();
    const secondUnlock = runtime.unlock();
    const playback = runtime.playSample('gesture:1,0', new Uint8Array([1]));

    expect(runtime.isUnlockPending).toBe(true);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(fake.resume).toHaveBeenCalledTimes(1);
    expect(fake.play).not.toHaveBeenCalled();

    fake.setState('running');
    resolveResume();
    await expect(firstUnlock).resolves.toBe(true);
    await expect(secondUnlock).resolves.toBe(true);
    await expect(playback).resolves.toBe(true);
    expect(runtime.isUnlockPending).toBe(false);
    expect(fake.play).toHaveBeenCalledTimes(1);
  });

  it('retries after resume rejection and treats an already running adapter as unlocked without resume', async () => {
    const rejected = createFakeAdapter();
    rejected.resume.mockRejectedValueOnce(new Error('gesture rejected'));
    const runtime = new BrowserAudioRuntime(() => rejected.adapter);

    await expect(runtime.unlock()).resolves.toBe(false);
    await expect(runtime.unlock()).resolves.toBe(true);
    expect(rejected.resume).toHaveBeenCalledTimes(2);

    const running = createFakeAdapter();
    Object.defineProperty(running.adapter, 'state', { value: 'running' });
    const runningRuntime = new BrowserAudioRuntime(() => running.adapter);
    await expect(runningRuntime.unlock()).resolves.toBe(true);
    expect(running.resume).not.toHaveBeenCalled();
  });

  it('does not unlock or play through an adapter after cleanup wins an in-flight resume race', async () => {
    let resolveResume!: () => void;
    const fake = createFakeAdapter();
    fake.resume.mockImplementation(() => new Promise<void>((resolve) => { resolveResume = resolve; }));
    const runtime = new BrowserAudioRuntime(() => fake.adapter);
    const unlock = runtime.unlock();
    const playback = runtime.playSample('stale:1,0', new Uint8Array([1]));

    await runtime.cleanup();
    resolveResume();

    await expect(unlock).resolves.toBe(false);
    await expect(playback).resolves.toBe(false);
    expect(runtime.status).toBe('closed');
    expect(fake.play).not.toHaveBeenCalled();
  });

  it('keeps a resolved-but-suspended context locked and retries on the next gesture', async () => {
    const diagnostics: AudioRuntimeDiagnostic[] = [];
    const fake = createFakeAdapter();
    fake.resume.mockResolvedValue(undefined);
    const runtime = new BrowserAudioRuntime(() => fake.adapter, (item) => diagnostics.push(item));

    await expect(runtime.unlock('keydown')).resolves.toBe(false);
    expect(runtime.status).toBe('locked');
    expect(diagnostics[diagnostics.length - 1]).toMatchObject({
      code: 'audio_locked',
      userGestureType: 'keydown',
      contextStateAfterResume: 'suspended',
      runtimeUnlockedFlag: false,
    });

    fake.resume.mockImplementationOnce(async () => { fake.setState('running'); });
    await expect(runtime.unlock('pointerdown')).resolves.toBe(true);
    expect(fake.resume).toHaveBeenCalledTimes(2);
    expect(runtime.status).toBe('unlocked');
  });

  it('gives first mount, StrictMode remount, and fresh reload runtimes distinct lifecycle identities', async () => {
    const diagnostics: AudioRuntimeDiagnostic[] = [];
    const firstFake = createFakeAdapter();
    const first = new BrowserAudioRuntime(() => firstFake.adapter, (item) => diagnostics.push(item));
    await first.unlock('keydown');
    await first.cleanup();

    const remountFake = createFakeAdapter();
    const remount = new BrowserAudioRuntime(() => remountFake.adapter, (item) => diagnostics.push(item));
    await remount.unlock('keydown');
    await remount.cleanup();

    const reloadFake = createFakeAdapter();
    const reload = new BrowserAudioRuntime(() => reloadFake.adapter, (item) => diagnostics.push(item));
    await reload.unlock('keydown');

    const created = diagnostics.filter((item) => item.code === 'audio_runtime_created');
    expect(new Set(created.map((item) => item.runtimeInstanceId)).size).toBe(3);
    expect(diagnostics.filter((item) => item.code === 'audio_cleanup_started')).toHaveLength(2);
    expect(diagnostics.filter((item) => item.code === 'audio_context_closed')).toHaveLength(2);
  });

  it('records muted, zero-volume, decode, source start, and closed-runtime rejection details', async () => {
    const diagnostics: AudioRuntimeDiagnostic[] = [];
    const fake = createFakeAdapter();
    const runtime = new BrowserAudioRuntime(() => fake.adapter, (item) => diagnostics.push(item));
    runtime.setMuted(true);
    runtime.setMasterVolume(0);
    await runtime.unlock('keydown');
    await expect(runtime.playSample('known:1,0', new Uint8Array([1]))).resolves.toBe(true);

    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'audio_play_sample_started', sampleKey: 'known:1,0', muted: true, masterVolume: 0 }),
      expect.objectContaining({ code: 'audio_decode_started', sampleKey: 'known:1,0' }),
      expect.objectContaining({ code: 'audio_decode_completed', sampleKey: 'known:1,0' }),
      expect.objectContaining({ code: 'audio_source_started', sampleKey: 'known:1,0' }),
      expect.objectContaining({ code: 'playback_started', sampleKey: 'known:1,0' }),
    ]));

    await runtime.cleanup();
    await expect(runtime.playSample('known:1,0', new Uint8Array([1]))).resolves.toBe(false);
    expect(diagnostics[diagnostics.length - 1]).toMatchObject({ code: 'audio_playback_rejected', runtimeStatus: 'closed' });
    expect(formatAudioRuntimeDiagnostic(diagnostics[diagnostics.length - 1]!)).toContain('runtimeStatus=closed');
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

  it('keeps individual volume and channel lifecycle intact at 100, 50, and 0 percent master gain', async () => {
    const fake = createFakeAdapter();
    const runtime = new BrowserAudioRuntime(() => fake.adapter);
    await runtime.unlock();
    runtime.setMasterVolume(1);
    await runtime.playSample('loop', new Uint8Array([1]), { channelKey: 'p1:4', volume: 0.8, pan: 0.1, loop: true });
    runtime.setMasterVolume(0.5);
    runtime.setMasterVolume(0);

    expect(fake.gains).toEqual([1, 1, 0.5, 0]);
    expect(fake.play.mock.calls[0][1]).toMatchObject({ volume: 0.8, pan: 0.1, loop: true });
    expect(runtime.updateChannelPan('p1:4', -0.25)).toBe('updated');
    expect(runtime.stopChannel('p1:4')).toBe(true);
    expect(fake.stop).toHaveBeenCalledTimes(1);
  });

  it('routes channel gain through pan and the shared ramped master gain', () => {
    const originalAudioContext = globalThis.AudioContext;
    const graph = createFakeWebAudioGraph();
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: graph.AudioContext });
    try {
      const adapter = createWebAudioAdapter()!;
      adapter.setMasterGain(0.5);
      adapter.play({}, { volume: 0.8, pan: 0.25 });

      expect(graph.master.connect).toHaveBeenCalledWith(graph.destination);
      expect(graph.source.connect).toHaveBeenCalledWith(graph.channelGain);
      expect(graph.channelGain.connect).toHaveBeenCalledWith(graph.panner);
      expect(graph.panner.connect).toHaveBeenCalledWith(graph.master);
      expect(graph.channelGain.gain.value).toBe(0.8);
      expect(graph.master.gain.cancelScheduledValues).toHaveBeenCalledWith(2);
      expect(graph.master.gain.setValueAtTime).toHaveBeenCalledWith(1, 2);
      expect(graph.master.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, 2.015);
    } finally {
      Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: originalAudioContext });
    }
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

  it('releases every channel-less voice during long-session cleanup without recreating the adapter', async () => {
    const fake = createFakeAdapter();
    const factory = vi.fn(() => fake.adapter);
    const runtime = new BrowserAudioRuntime(factory);
    await runtime.unlock();
    for (let index = 0; index < 240; index += 1) {
      await runtime.playSample(`long:${index % 3}`, new Uint8Array([index % 3]));
    }
    await runtime.cleanup();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(fake.play).toHaveBeenCalledTimes(240);
    expect(fake.stop).toHaveBeenCalledTimes(240);
    expect(fake.close).toHaveBeenCalledTimes(1);
  });
});

function createFakeAdapter(supportsPan = true) {
  const stop = vi.fn();
  let state = 'suspended';
  const resume = vi.fn(async () => { state = 'running'; });
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
    get state() { return state; }, resume, decode, play,
    setMasterGain(value) { gains.push(value); },
    close,
  };
  return { adapter, stop, resume, decode, play, close, gains, endedCallbacks, pans, setState(value: string) { state = value; } };
}

function createFakeWebAudioGraph() {
  const destination = {} as AudioDestinationNode;
  const audioParam = () => ({
    value: 1,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  const master = { gain: audioParam(), connect: vi.fn() };
  const channelGain = { gain: audioParam(), connect: vi.fn() };
  const source = { buffer: null, loop: false, playbackRate: { value: 1 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
  const panner = { pan: { value: 0 }, connect: vi.fn() };
  let gainCount = 0;
  class FakeAudioContext {
    state = 'running';
    currentTime = 2;
    destination = destination;
    createGain() { gainCount += 1; return gainCount === 1 ? master : channelGain; }
    createBufferSource() { return source; }
    createStereoPanner() { return panner; }
    resume = vi.fn(async () => {});
    decodeAudioData = vi.fn(async () => ({}));
    close = vi.fn(async () => {});
  }
  return { AudioContext: FakeAudioContext as unknown as typeof AudioContext, destination, master, channelGain, source, panner };
}
