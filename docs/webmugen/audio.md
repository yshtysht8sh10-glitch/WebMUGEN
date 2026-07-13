# Browser Audio Runtime

Updated: 2026-07-13

## Responsibility

`BrowserAudioRuntime` is the shared Web Audio boundary. CNS controllers and combat code must request sound behavior through runtime APIs instead of creating `AudioContext` objects directly.

The runtime provides:

- lazy creation and reuse of one adapter/AudioContext per mounted app;
- `resume()` after a pointer or keyboard user gesture;
- decoded sample Promise caching by stable owner/sample key;
- master gain and mute;
- active-source stop and context cleanup;
- safe fallback and diagnostics for unsupported, locked, resume-rejected, and decode-failed environments.

## Lifecycle

React re-renders do not create another context. The app-level effect owns the runtime for the component lifetime. Character reload and round restart stop active sources; component unmount stops sources, clears decoded data, and closes the context.

The Settings Audio panel exposes current status, an explicit unlock action, master gain/mute, and play/stop/pan test actions for the first loaded WAV sample. These actions exercise the shared runtime API only. They do not implement CNS controller semantics.

## Diagnostics

Current diagnostic codes are:

- `audio_unsupported`
- `audio_locked`
- `audio_unlocked`
- `decode_failed`
- `playback_started`
- `playback_stopped`
- `audio_closed`

Autoplay/resume rejection is `audio_locked`, not a character load failure. Missing SND lookup is reported by the caller as `sound_asset_missing`.

## Compatibility boundary

Issue #27 completes the browser audio foundation. Issue #28 connects PlaySnd character samples with owner-scoped channel replacement, channel-less concurrent voices, volume scaling, pan, playback rate, and loop. Issue #29 connects StopSnd to the same owner/channel table; Issue #40 connects SndPan updates to the current matching voice. HitDef sound integration remains Partial until Issue #36 deliberately routes scoped cues through the same runtime.

PlaySnd cache keys include owner id plus group/index, and channel keys include owner id plus channel number. P1 channel 0 therefore cannot stop or replace P2 channel 0. `S`/unprefixed values use character SND; `F` common sound is rejected explicitly until a common archive is loaded.

Pause/SuperPause does not suspend AudioContext or stop active voices. A PlaySnd controller reached on the activation CNS pass starts normally; globally paused and guarded resume passes skip CNS controllers, so that boundary does not create duplicate voices. Exact same-pass ordering between multiple players remains Partial.

StopSnd evaluates `channel` on the firing frame. A matching active or looping voice stops immediately and is removed from active/channel tables. Natural `onended` performs the same release. Missing channels are diagnosed no-ops; omitted channel is currently an explicit `channel_missing` no-op and keeps the Matrix row Partial.

SndPan evaluates `channel` and `pan`/`abspan` on the firing frame. Relative `pan` follows player Facing; `abspan` is absolute and takes precedence when malformed data supplies both. The app normalizes the current compatibility range by dividing by 100 and clamps to `[-1, 1]`, then updates the existing StereoPanner without recreating the source. Missing/ended channels and adapters without StereoPanner support are diagnosed no-ops. Exact WinMUGEN pixel-to-speaker mapping and player screen-position contribution remain unaudited, so the Matrix row remains Partial.

## Test expectations

- adapter factory is called once across repeated unlock/play calls;
- playback before unlock is rejected safely;
- identical sample keys decode once and can play multiple times;
- master gain and mute produce deterministic adapter gain values;
- stop/cleanup stop active handles and close the adapter;
- pan updates affect only the current owner/channel handle, including loop and replacement cases;
- unsupported, rejected resume, and failed decode paths emit diagnostics;
- a real browser user gesture unlocks Web Audio where the browser exposes it;
- unsupported browser harnesses show `audio_unsupported` without breaking the game.
