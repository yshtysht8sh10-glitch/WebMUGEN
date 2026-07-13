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

The Settings Audio panel exposes current status, an explicit unlock action, master gain/mute, and a test action for the first loaded WAV sample. This test action exercises the shared runtime API only. It does not implement `PlaySnd` controller semantics.

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

Issue #27 completes the browser audio foundation. Issue #28 connects PlaySnd character samples with owner-scoped channel replacement, channel-less concurrent voices, volume scaling, pan, playback rate, and loop. Issues #29 and #40 add StopSnd and SndPan channel control. HitDef sound integration remains Partial until Issue #36 deliberately routes scoped cues through the same runtime.

PlaySnd cache keys include owner id plus group/index, and channel keys include owner id plus channel number. P1 channel 0 therefore cannot stop or replace P2 channel 0. `S`/unprefixed values use character SND; `F` common sound is rejected explicitly until a common archive is loaded.

## Test expectations

- adapter factory is called once across repeated unlock/play calls;
- playback before unlock is rejected safely;
- identical sample keys decode once and can play multiple times;
- master gain and mute produce deterministic adapter gain values;
- stop/cleanup stop active handles and close the adapter;
- unsupported, rejected resume, and failed decode paths emit diagnostics;
- a real browser user gesture unlocks Web Audio where the browser exposes it;
- unsupported browser harnesses show `audio_unsupported` without breaking the game.
