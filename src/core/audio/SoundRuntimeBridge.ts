import { findSndSample, sndSampleKey, type SndDocument } from '../../parser/snd/SndTypes';
import type { BrowserAudioRuntime } from './BrowserAudioRuntime';
import type { SoundRuntimeEvent } from './SoundEvent';

export function processSoundRuntimeEvents(
  events: readonly SoundRuntimeEvent[],
  characterSounds: SndDocument | null,
  commonSounds: SndDocument | null,
  runtime: BrowserAudioRuntime | null,
): string[] {
  return events.map((event) => {
    if (event.type === 'stop') {
      if (event.channel === null) return `raw.sound_stop owner=${event.ownerId} channel=- result=noop reason=channel_missing`;
      const stopped = runtime?.stopChannel(`${event.ownerId}:${Math.trunc(event.channel)}`) ?? false;
      return `raw.sound_stop owner=${event.ownerId} channel=${Math.trunc(event.channel)} result=${stopped ? 'stopped' : 'noop'}${stopped ? '' : ' reason=channel_not_found'}`;
    }
    if (event.type === 'pan') {
      if (event.channel === null) return `raw.sound_pan owner=${event.ownerId} channel=- result=noop reason=channel_missing`;
      if (event.pan === null || event.mode === null) return `raw.sound_pan owner=${event.ownerId} channel=${Math.trunc(event.channel)} result=noop reason=pan_missing`;
      const normalized = Math.min(1, Math.max(-1, event.pan / 100));
      const result = runtime?.updateChannelPan(`${event.ownerId}:${Math.trunc(event.channel)}`, normalized) ?? 'channel_not_found';
      return `raw.sound_pan owner=${event.ownerId} channel=${Math.trunc(event.channel)} mode=${event.mode} raw=${event.pan} normalized=${normalized} result=${result === 'updated' ? 'updated' : 'noop'}${result === 'updated' ? '' : ` reason=${result}`}`;
    }
    const soundDocument = event.scope === 'common' ? commonSounds : characterSounds;
    const scopePrefix = event.scope === 'common' ? 'F' : '';
    if (!soundDocument) return `raw.sound_play_rejected owner=${event.ownerId} sample=${scopePrefix}${event.group},${event.index} reason=${event.scope === 'common' ? 'common_sound_unavailable' : 'sound_asset_missing'}`;
    const sample = findSndSample(soundDocument, event.group, event.index);
    if (!sample) return `raw.sound_play_rejected owner=${event.ownerId} sample=${scopePrefix}${event.group},${event.index} reason=sample_not_found`;
    const volume = Math.min(1, Math.max(0, (event.volume / 100) * (event.volumeScale / 100)));
    const pan = Math.min(1, Math.max(-1, event.pan / 100));
    if (!runtime || runtime.status !== 'unlocked') return `raw.sound_play_rejected owner=${event.ownerId} sample=${scopePrefix}${event.group},${event.index} reason=audio_locked`;
    void runtime.playSample(`${event.scope}:${event.ownerId}:${sndSampleKey(event.group, event.index)}`, sample.bytes, {
      channelKey: event.channel === null ? undefined : `${event.ownerId}:${Math.trunc(event.channel)}`,
      volume,
      pan,
      playbackRate: event.frequencyMultiplier,
      loop: event.loop,
    });
    return `raw.sound_play owner=${event.ownerId} scope=${event.scope} sample=${scopePrefix}${event.group},${event.index} channel=${event.channel ?? '-'} volume=${event.volume} volumescale=${event.volumeScale} pan=${event.pan} freqmul=${event.frequencyMultiplier} loop=${event.loop ? 1 : 0} result=queued`;
  });
}
