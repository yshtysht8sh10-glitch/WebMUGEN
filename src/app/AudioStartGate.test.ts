import { describe, expect, it, vi } from 'vitest';
import { BrowserAudioRuntime, type AudioAdapter, type AudioPlaybackHandle } from '../core/audio/BrowserAudioRuntime';
import type { SoundPlayEvent } from '../core/audio/SoundEvent';
import { processSoundRuntimeEvents } from '../core/audio/SoundRuntimeBridge';
import type { SndDocument, SndSample } from '../parser/snd/SndTypes';
import { createAudioStartGate, type RuntimeStartState } from './AudioStartGate';

describe('Audio Start Gate', () => {
  it.each(['pointerdown', 'keydown'] as const)('starts unlock directly from %s and waits for running before the loop', async (gestureType) => {
    let resolveUnlock!: (value: boolean) => void;
    let contextState = 'suspended';
    const unlock = vi.fn(() => new Promise<boolean>((resolve) => { resolveUnlock = resolve; }));
    const states: RuntimeStartState[] = [];
    const startGameLoop = vi.fn();
    const gate = createAudioStartGate({
      runtime: { status: 'locked', get contextState() { return contextState; }, unlock },
      onStateChange: (state) => states.push(state),
    });

    gate.prepare(startGameLoop);
    expect(states).toEqual(['waiting-for-user']);
    expect(startGameLoop).not.toHaveBeenCalled();

    const attempt = gate.handleUserGesture(gestureType);
    expect(unlock).toHaveBeenCalledWith(gestureType);
    expect(states[states.length - 1]).toBe('unlocking-audio');
    expect(startGameLoop).not.toHaveBeenCalled();

    contextState = 'running';
    resolveUnlock(true);
    await attempt;
    expect(states[states.length - 1]).toBe('running');
    expect(startGameLoop).toHaveBeenCalledTimes(1);
  });

  it('keeps the overlay after resume rejection and starts on a running retry exactly once', async () => {
    let contextState = 'suspended';
    const unlock = vi.fn()
      .mockResolvedValueOnce(false)
      .mockImplementationOnce(async () => { contextState = 'running'; return true; });
    const states: RuntimeStartState[] = [];
    const startGameLoop = vi.fn();
    const gate = createAudioStartGate({
      runtime: { status: 'locked', get contextState() { return contextState; }, unlock },
      onStateChange: (state) => states.push(state),
    });
    gate.prepare(startGameLoop);

    await gate.handleUserGesture('keydown');
    expect(states[states.length - 1]).toBe('audio-unavailable');
    expect(startGameLoop).not.toHaveBeenCalled();

    await gate.handleUserGesture('pointerdown');
    await gate.handleUserGesture('keydown');
    expect(states[states.length - 1]).toBe('running');
    expect(startGameLoop).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit continue action when audio is unsupported', async () => {
    const states: RuntimeStartState[] = [];
    const startGameLoop = vi.fn();
    const gate = createAudioStartGate({
      runtime: { status: 'unsupported', contextState: 'unsupported', unlock: vi.fn(async () => false) },
      onStateChange: (state) => states.push(state),
    });
    gate.prepare(startGameLoop);

    await gate.handleUserGesture('pointerdown');
    expect(states[states.length - 1]).toBe('audio-unavailable');
    expect(startGameLoop).not.toHaveBeenCalled();

    gate.continueWithoutAudio();
    gate.continueWithoutAudio();
    expect(states[states.length - 1]).toBe('running');
    expect(startGameLoop).toHaveBeenCalledTimes(1);
  });

  it('does not let a disposed StrictMode mount start after remount', async () => {
    let resolveOld!: (value: boolean) => void;
    const oldStart = vi.fn();
    const oldGate = createAudioStartGate({
      runtime: { status: 'locked', contextState: 'running', unlock: () => new Promise<boolean>((resolve) => { resolveOld = resolve; }) },
      onStateChange() {},
    });
    oldGate.prepare(oldStart);
    const oldAttempt = oldGate.handleUserGesture('keydown');
    oldGate.dispose();

    const newStart = vi.fn();
    const newGate = createAudioStartGate({
      runtime: { status: 'unlocked', contextState: 'running', unlock: vi.fn(async () => true) },
      onStateChange() {},
    });
    newGate.prepare(newStart);
    resolveOld(true);
    await oldAttempt;

    expect(oldStart).not.toHaveBeenCalled();
    expect(newStart).toHaveBeenCalledTimes(1);
  });

  it('creates one context and records audio_unlocked before State 230 PlaySnd without audio_locked rejection', async () => {
    const sequence: string[] = [];
    const played: unknown[] = [];
    let state = 'suspended';
    const factory = vi.fn((): AudioAdapter => ({
      get state() { return state; },
      async resume() { state = 'running'; },
      async decode(bytes) { return bytes.byteLength; },
      play(decoded): AudioPlaybackHandle { played.push(decoded); return { stop() {} }; },
      setMasterGain() {},
      async close() {},
    }));
    const runtime = new BrowserAudioRuntime(factory, (item) => sequence.push(item.code));
    let soundLines: string[] = [];
    const gate = createAudioStartGate({ runtime, onStateChange() {} });
    gate.prepare(() => {
      soundLines = processSoundRuntimeEvents([playEvent(230, 1)], soundDocument([[230, 1]]), null, runtime);
      sequence.push(...soundLines);
    });

    await gate.handleUserGesture('keydown');
    await gate.handleUserGesture('pointerdown');
    await Promise.resolve();
    await Promise.resolve();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(soundLines.join('\n')).toContain('raw.sound_play owner=1 scope=character sample=230,1');
    expect(soundLines.join('\n')).not.toContain('reason=audio_locked');
    expect(sequence.indexOf('audio_unlocked')).toBeLessThan(sequence.findIndex((item) => item.startsWith('raw.sound_play ')));
    expect(sequence).toContain('playback_started');
    expect(played).toHaveLength(1);
  });
});

function playEvent(group: number, index: number): SoundPlayEvent {
  return { type: 'play', ownerId: 1, scope: 'character', group, index, channel: null, volume: 100, volumeScale: 100, pan: 0, absolutePan: false, frequencyMultiplier: 1, loop: false };
}

function soundDocument(keys: Array<[number, number]>): SndDocument {
  const samples = keys.map(([group, index], sourceOffset): SndSample => ({ group, index, bytes: new Uint8Array([1, 2, 3, 4]), sourceOffset, format: 'wave' }));
  return { version: [1, 0, 0, 0], declaredSampleCount: samples.length, firstSubfileOffset: 0, samples, samplesByKey: new Map(samples.map((sample) => [`${sample.group},${sample.index}`, sample])), diagnostics: [] };
}
