import { describe, expect, it, vi } from 'vitest';
import type { SndDocument, SndSample } from '../../parser/snd/SndTypes';
import { BrowserAudioRuntime, type AudioAdapter, type AudioPlaybackHandle } from './BrowserAudioRuntime';
import type { SoundPlayEvent } from './SoundEvent';
import { processSoundRuntimeEvents } from './SoundRuntimeBridge';

describe('shared Sound runtime bridge', () => {
  it('plays HitDef-compatible character and common events through the Browser Audio runtime', async () => {
    const played: Array<{ decoded: unknown; sampleKey?: string }> = [];
    const runtime = new BrowserAudioRuntime((): AudioAdapter => ({
      state: 'running',
      async resume() {},
      async decode(bytes) { return bytes.byteLength; },
      play(decoded): AudioPlaybackHandle { played.push({ decoded }); return { stop() {} }; },
      setMasterGain() {},
      async close() {},
    }));
    await runtime.unlock();
    const character = soundDocument([[1, 2]]);
    const common = soundDocument([[5, 6]]);
    const lines = processSoundRuntimeEvents([
      playEvent('character', 1, 2),
      playEvent('common', 5, 6),
    ], character, common, runtime);
    await Promise.resolve();
    await Promise.resolve();
    expect(lines).toEqual(expect.arrayContaining([
      expect.stringContaining('raw.sound_runtime_event type=play'),
      expect.stringContaining('raw.sound_lookup owner=1 scope=character sample=1,2 result=found'),
      expect.stringContaining('raw.sound_play owner=1 scope=character sample=1,2'),
      expect.stringContaining('raw.sound_lookup owner=1 scope=common sample=F5,6 result=found'),
      expect.stringContaining('raw.sound_play owner=1 scope=common sample=F5,6'),
    ]));
    expect(played).toHaveLength(2);
  });

  it('diagnoses missing common assets and locked audio safely', () => {
    expect(processSoundRuntimeEvents([playEvent('common', 5, 6)], null, null, null).join('\n')).toContain('reason=common_sound_unavailable');
    expect(processSoundRuntimeEvents([playEvent('character', 1, 2)], soundDocument([[1, 2]]), null, null).join('\n')).toContain('reason=audio_locked');
  });

  it('retains PlaySnd and HitDef sound requests while the first gesture unlock is pending', async () => {
    let resolveResume!: () => void;
    let state = 'suspended';
    const played: unknown[] = [];
    const resume = vi.fn(() => new Promise<void>((resolve) => { resolveResume = () => { state = 'running'; resolve(); }; }));
    const runtime = new BrowserAudioRuntime((): AudioAdapter => ({
      get state() { return state; },
      resume,
      async decode(bytes) { return bytes.byteLength; },
      play(decoded): AudioPlaybackHandle { played.push(decoded); return { stop() {} }; },
      setMasterGain() {},
      async close() {},
    }));
    const unlock = runtime.unlock();
    const lines = processSoundRuntimeEvents([
      playEvent('character', 1, 2),
      playEvent('character', 3, 4),
    ], soundDocument([[1, 2], [3, 4]]), null, runtime);

    expect(lines.filter((line) => line.startsWith('raw.sound_play '))).toEqual([
      expect.stringContaining('sample=1,2'),
      expect.stringContaining('sample=3,4'),
    ]);
    expect(lines.every((line) => !line.includes('reason=audio_locked'))).toBe(true);
    expect(played).toHaveLength(0);

    resolveResume();
    await unlock;
    await Promise.resolve();
    await Promise.resolve();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(played).toHaveLength(2);
  });
});

function playEvent(scope: 'character' | 'common', group: number, index: number): SoundPlayEvent {
  return { type: 'play', ownerId: 1, scope, group, index, channel: null, volume: 100, volumeScale: 100, pan: 0, absolutePan: false, frequencyMultiplier: 1, loop: false };
}

function soundDocument(keys: Array<[number, number]>): SndDocument {
  const samples = keys.map(([group, index], sourceOffset): SndSample => ({ group, index, bytes: new Uint8Array([1, 2, 3, 4]), sourceOffset, format: 'wave' }));
  return { version: [1, 0, 0, 0], declaredSampleCount: samples.length, firstSubfileOffset: 0, samples, samplesByKey: new Map(samples.map((sample) => [`${sample.group},${sample.index}`, sample])), diagnostics: [] };
}
