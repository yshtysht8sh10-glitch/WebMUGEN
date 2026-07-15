# Browser Audio Runtime

Updated: 2026-07-15

## Responsibility

`BrowserAudioRuntime` is the shared Web Audio boundary. CNS controllers and combat code must request sound behavior through runtime APIs instead of creating `AudioContext` objects directly.

The runtime provides:

- lazy creation and reuse of one adapter/AudioContext per mounted app;
- `resume()` after a pointer or keyboard user gesture;
- decoded sample Promise caching by stable owner/sample key;
- one shared ramped master gain and mute after every channel gain/pan node;
- active-source stop and context cleanup;
- safe fallback and diagnostics for unsupported, locked, resume-rejected, and decode-failed environments.

## Lifecycle

React re-renders do not create another context. The app-level effect owns the runtime for the component lifetime. Character reload and round restart stop active sources; component unmount stops sources, clears decoded data, and closes the context.

Issue #51 uses an Audio Start Gate instead of racing the first game input against `resume()`. Character/assets load first, but `BrowserInput`, `CanvasRenderer`, and the requestAnimationFrame loop are not started. The canvas overlay shows `クリックまたはキー入力で開始`; its own `pointerdown` or `keydown` handler calls `BrowserAudioRuntime.unlock()` synchronously in that gesture stack. The prepared game-loop closure starts exactly once only after unlock returns true and the adapter reports `running`. A rejected or resolved-but-suspended resume keeps the overlay visible and retryable. Unsupported/repeated failure exposes an explicit `音声なしで開始` action. The old BrowserInput unlock callback and independent window keydown listener are not part of this path. Runtime, Manual, and Settings tab changes are not startup signals.

The gate states are `loading`, `waiting-for-user`, `unlocking-audio`, `running`, and `audio-unavailable`. StrictMode cleanup disposes the old gate before closing its runtime and cancels any old requestAnimationFrame; a late old unlock Promise cannot start the loop. Character changes reuse an already-running shared AudioContext and start the newly prepared loop without creating another context.

The Settings Audio panel exposes current status, an explicit unlock action, a keyboard-operable 0-100 master slider with current percentage, mute, and play/stop/pan test actions for the first loaded WAV sample. The safe first-run default is 50%. Volume and mute are stored under `webmugen.audioSettings.v1`; missing, malformed, old-shaped, out-of-range, inaccessible, and quota-blocked storage falls back without disabling the game. SSR/test execution without `localStorage` uses the same default.

The audio graph is `individual Sound gain -> channel StereoPanner when supported -> shared master GainNode -> AudioContext destination`. A 100% master leaves CNS `PlaySnd volume` ratios unchanged, 50% halves the final graph output, and 0% silences without stopping sources or deleting channel state. Mute drives the same master node to zero and restores the stored slider value when released. Master changes use a 15 ms linear ramp and therefore affect already-playing one-shot and loop voices without recreating them. Settings changed before AudioContext unlock are retained and applied when the lazy adapter is created.

## Diagnostics

Current diagnostic codes are:

- `audio_runtime_created`
- `audio_context_created`
- `audio_unsupported`
- `audio_unlock_requested`
- `audio_resume_requested`
- `audio_resume_resolved`
- `audio_resume_rejected`
- `audio_locked`
- `audio_unlocked`
- `audio_play_sample_started`
- `audio_playback_rejected`
- `audio_decode_started`
- `audio_decode_completed`
- `decode_failed`
- `audio_source_started`
- `playback_started`
- `playback_stopped`
- `audio_cleanup_started`
- `audio_context_close_requested`
- `audio_context_closed`
- `audio_context_close_rejected`
- `audio_closed`

Autoplay/resume rejection is `audio_locked`, not a character load failure. Missing SND lookup is reported by the caller as `sound_asset_missing`.
Every `raw.audio` line includes `runtimeInstanceId`, runtime/context state, unlocked flag, mute, and master volume. Unlock lines additionally record gesture type, before/after state, and requested/resolved/rejected flags. Playback lines cover runtime entry, decode start/completion/failure, adapter `source.start()`, and final `playback_started`. `raw.audio_lifecycle` preserves mount, React effect cleanup, and character-path `stopAll` records across the character-history reset, so StrictMode remount and F5-created fresh runtimes can be distinguished without switching debug tabs.

`raw.sound_runtime_event` proves SoundRuntimeEvent generation and `raw.sound_lookup` proves the selected SND scope/sample lookup before `raw.sound_play` or `raw.sound_play_rejected`. Focused tests use a known in-memory WAV sample rather than State 230 collision, whose current `clsn1_missing` rejection cannot prove the HitDef sound path.

## Compatibility boundary

Issue #27 completes the browser audio foundation. Issue #28 connects PlaySnd character samples with owner-scoped channel replacement, channel-less concurrent voices, volume scaling, pan, playback rate, and loop. Issue #29 connects StopSnd to the same owner/channel table; Issue #40 connects SndPan updates to the current matching voice. Issue #36 routes HitDef `hitsound`/`guardsound` cues through that same bridge once per HitEvent.

PlaySnd cache keys include owner id plus group/index, and channel keys include owner id plus channel number. P1 channel 0 therefore cannot stop or replace P2 channel 0. `S`/unprefixed values use character SND; `F` common sound is rejected explicitly until a common archive is loaded.

HitDef scope rules differ from PlaySnd syntax: `S` uses the attacker character SND; unprefixed and explicit `F` use common SND. Both group and index expressions are evaluated on HitDef activation. Valid character samples become channel-less one-shot SoundPlayEvents and are verified with bundled T-H-M-A. The bridge supports a supplied common archive, but the app currently has none and reports `common_snd_missing`/`common_sound_unavailable`.

Pause/SuperPause does not suspend AudioContext or stop active voices. A PlaySnd controller reached on the activation CNS pass starts normally; globally paused and guarded resume passes skip CNS controllers, so that boundary does not create duplicate voices. Exact same-pass ordering between multiple players remains Partial.

StopSnd evaluates `channel` on the firing frame. A matching active or looping voice stops immediately and is removed from active/channel tables. Natural `onended` performs the same release. Missing channels are diagnosed no-ops; omitted channel is currently an explicit `channel_missing` no-op and keeps the Matrix row Partial.

SndPan evaluates `channel` and `pan`/`abspan` on the firing frame. Relative `pan` follows player Facing; `abspan` is absolute and takes precedence when malformed data supplies both. The app normalizes the current compatibility range by dividing by 100 and clamps to `[-1, 1]`, then updates the existing StereoPanner without recreating the source. Missing/ended channels and adapters without StereoPanner support are diagnosed no-ops. Exact WinMUGEN pixel-to-speaker mapping and player screen-position contribution remain unaudited, so the Matrix row remains Partial.

Issue #37 verifies real PlaySnd sample resolution for KFM, T-H-M-A, and Yes030_e-rada, real T-H-M-A StopSnd presence, bundled T-H-M-A ZIP SND loading, and cleanup of 240 channel-less voices through one adapter. SndPan has no occurrence in that set, so its focused production tests remain the evidence and its status stays Partial.

Issue #44 adds the persistent user master controls described above. This is an application safety/output multiplier after MUGEN sound semantics, so it does not increase the PlaySnd Matrix percentage or change controller compatibility claims.

## Test expectations

- adapter factory is called once across repeated unlock/play calls;
- concurrent first gestures share one `resume()` attempt, and same-gesture playback waits for it;
- resume rejection remains retryable while unmount invalidates pending unlock/playback;
- playback before unlock is rejected safely;
- identical sample keys decode once and can play multiple times;
- master gain and mute produce deterministic adapter gain values;
- 100%, 50%, 0%, and mute/unmute update the shared node while individual gain, live pan, loop, replacement, and stop state remain intact;
- the UI persists and restores a 0-100 value and mute state, rejects invalid storage, exposes explicit ARIA labels, and keeps native range keyboard behavior;
- stop/cleanup stop active handles and close the adapter;
- pan updates affect only the current owner/channel handle, including loop and replacement cases;
- unsupported, rejected resume, and failed decode paths emit diagnostics;
- a real browser user gesture unlocks Web Audio where the browser exposes it;
- unsupported browser harnesses show `audio_unsupported` and require the explicit no-audio continuation before the game loop starts.
