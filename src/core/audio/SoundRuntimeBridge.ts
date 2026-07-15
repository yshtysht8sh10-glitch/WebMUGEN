import { findSndSample, sndSampleKey, type SndDocument } from '../../parser/snd/SndTypes';
import type { BrowserAudioRuntime } from './BrowserAudioRuntime';
import type { SoundRuntimeEvent } from './SoundEvent';

export function processSoundRuntimeEvents(
  events: readonly SoundRuntimeEvent[],
  characterSounds: SndDocument | null,
  commonSounds: SndDocument | null,
  runtime: BrowserAudioRuntime | null,
): string[] {
  const lines: string[] = [];
  for (const event of events) {
    lines.push(`raw.sound_runtime_event type=${event.type} owner=${event.ownerId} generated=1`);
    if (event.type === 'stop') {
      if (event.channel === null) {
        lines.push(`raw.sound_stop owner=${event.ownerId} channel=- result=noop reason=channel_missing`);
        continue;
      }
      const stopped = runtime?.stopChannel(`${event.ownerId}:${Math.trunc(event.channel)}`) ?? false;
      lines.push(`raw.sound_stop owner=${event.ownerId} channel=${Math.trunc(event.channel)} result=${stopped ? 'stopped' : 'noop'}${stopped ? '' : ' reason=channel_not_found'}`);
      continue;
    }
    if (event.type === 'pan') {
      if (event.channel === null) {
        lines.push(`raw.sound_pan owner=${event.ownerId} channel=- result=noop reason=channel_missing`);
        continue;
      }
      if (event.pan === null || event.mode === null) {
        lines.push(`raw.sound_pan owner=${event.ownerId} channel=${Math.trunc(event.channel)} result=noop reason=pan_missing`);
        continue;
      }
      const normalized = Math.min(1, Math.max(-1, event.pan / 100));
      const result = runtime?.updateChannelPan(`${event.ownerId}:${Math.trunc(event.channel)}`, normalized) ?? 'channel_not_found';
      lines.push(`raw.sound_pan owner=${event.ownerId} channel=${Math.trunc(event.channel)} mode=${event.mode} raw=${event.pan} normalized=${normalized} result=${result === 'updated' ? 'updated' : 'noop'}${result === 'updated' ? '' : ` reason=${result}`}`);
      continue;
    }
    const soundDocument = event.scope === 'common' ? commonSounds : characterSounds;
    const scopePrefix = event.scope === 'common' ? 'F' : '';
    if (!soundDocument) {
      lines.push(`raw.sound_lookup owner=${event.ownerId} scope=${event.scope} sample=${scopePrefix}${event.group},${event.index} result=missing`);
      lines.push(`raw.sound_play_rejected owner=${event.ownerId} sample=${scopePrefix}${event.group},${event.index} reason=${event.scope === 'common' ? 'common_sound_unavailable' : 'sound_asset_missing'}`);
      continue;
    }
    const sample = findSndSample(soundDocument, event.group, event.index);
    if (!sample) {
      lines.push(`raw.sound_lookup owner=${event.ownerId} scope=${event.scope} sample=${scopePrefix}${event.group},${event.index} result=missing`);
      lines.push(`raw.sound_play_rejected owner=${event.ownerId} sample=${scopePrefix}${event.group},${event.index} reason=sample_not_found`);
      continue;
    }
    lines.push(`raw.sound_lookup owner=${event.ownerId} scope=${event.scope} sample=${scopePrefix}${event.group},${event.index} result=found bytes=${sample.bytes.byteLength}`);
    const volume = Math.min(1, Math.max(0, (event.volume / 100) * (event.volumeScale / 100)));
    const pan = Math.min(1, Math.max(-1, event.pan / 100));
    const runtimeDetails = runtime
      ? ` runtimeInstanceId=${runtime.runtimeInstanceId} runtimeStatus=${runtime.status} contextState=${runtime.contextState} muted=${runtime.isMuted ? 1 : 0} masterVolume=${runtime.masterVolumeValue}`
      : ' runtimeInstanceId=- runtimeStatus=missing contextState=- muted=- masterVolume=-';
    if (!runtime || (runtime.status !== 'unlocked' && !runtime.isUnlockPending)) {
      lines.push(`raw.sound_play_rejected owner=${event.ownerId} sample=${scopePrefix}${event.group},${event.index} reason=audio_locked${runtimeDetails}`);
      continue;
    }
    void runtime.playSample(`${event.scope}:${event.ownerId}:${sndSampleKey(event.group, event.index)}`, sample.bytes, {
      channelKey: event.channel === null ? undefined : `${event.ownerId}:${Math.trunc(event.channel)}`,
      volume,
      pan,
      playbackRate: event.frequencyMultiplier,
      loop: event.loop,
    });
    lines.push(`raw.sound_play owner=${event.ownerId} scope=${event.scope} sample=${scopePrefix}${event.group},${event.index} channel=${event.channel ?? '-'} volume=${event.volume} volumescale=${event.volumeScale} pan=${event.pan} freqmul=${event.frequencyMultiplier} loop=${event.loop ? 1 : 0} result=queued${runtimeDetails}`);
  }
  return lines;
}
