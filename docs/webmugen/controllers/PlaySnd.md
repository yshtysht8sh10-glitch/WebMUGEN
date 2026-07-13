# PlaySnd

`PlaySnd` plays a sample from a WinMUGEN character SND archive.

## Current status

**Partial - production character SND playback is connected.**

The CNS runtime evaluates parameters on every firing frame and emits an owner-scoped event. The app resolves the owner's character SND and plays it through the shared Browser Audio runtime.

## Supported syntax

```ini
[State 200, Voice]
type = PlaySnd
trigger1 = Time = 0
value = S2, 5
channel = 0
volume = 100
volumescale = 100
pan = 0
freqmul = 1.0
loop = 0
```

| Parameter | Current behavior |
|---|---|
| `value = group, index` | Expressions are evaluated on the firing frame. Unprefixed and `S` values select the owner character SND. `F` common scope is diagnosed unavailable. |
| `channel` | Replaces the previous voice only in the same owner/channel. Omission creates an independent voice. |
| `volume` / `volumescale` | Multiplicative gain with 100 as unity for each value. |
| `pan` | Partial relative pan: -100..100 maps to stereo -1..1 and mirrors with Facing. |
| `abspan` | Partial absolute pan, takes precedence over `pan`. |
| `freqmul` | Positive Web Audio playback rate. |
| `loop` | Loops until channel replacement, matching StopSnd, or runtime cleanup. |

## Diagnostics

Queued playback records:

```text
raw.sound_play owner=1 scope=character sample=2,5 channel=0
  volume=100 volumescale=100 pan=0 freqmul=1 loop=0 result=queued
```

Rejections use `sound_asset_missing`, `sample_not_found`, `common_sound_unavailable`, or `audio_locked`. Browser Audio diagnostics then report `playback_started` or `decode_failed`.

## Remaining work

PlaySnd remains Partial because common/fight SND is not loaded, exact WinMUGEN pan/volume edge ranges and `lowpriority` are not audited, and Helper/Projectile asset ownership is not connected. StopSnd owner/channel stopping is connected; SndPan is tracked by Issue #40.

The Issue #44 WebMUGEN master slider is a separate user output multiplier after PlaySnd gain, channel handling, and pan. Its first-run 50% default, mute, and persistence do not reinterpret `volume`/`volumescale`; 100% preserves the controller's existing output ratio exactly.
