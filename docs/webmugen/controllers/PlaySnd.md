# PlaySnd

`PlaySnd` is the WinMUGEN CNS state controller used to play a sound sample from a character SND archive.

## Current status

**Issue ready — implementation has not started yet.**

The CNS runtime currently recognizes `PlaySnd` as a safe no-op. The controller can be parsed without crashing, but it does not load or play audio yet.

- Compatibility Matrix: [WinMUGEN Compatibility Matrix](../winmugen-compatibility-matrix.html)
- Implementation Issue: [#28 Controller: PlaySnd を本格実装する](https://github.com/yshtysht8sh10-glitch/WebMUGEN/issues/28)
- Prerequisite Issue: [#26 SND v1 parserとCharacterLoader統合](https://github.com/yshtysht8sh10-glitch/WebMUGEN/issues/26)
- Prerequisite Issue: [#27 Browser Audio runtimeとAudioContext unlock](https://github.com/yshtysht8sh10-glitch/WebMUGEN/issues/27)

## Intended syntax

```ini
[State 200, Voice]
type = PlaySnd
trigger1 = Time = 0
value = 2, 5
channel = 0
volume = 100
pan = 0
freqmul = 1.0
loop = 0
```

## Parameters to support

| Parameter | Purpose | Current status |
|---|---|---|
| `value = group, index` | Selects a sample from the owner character's SND archive. | Not implemented |
| `channel` | Selects an owner-scoped playback channel and replaces the previous sound on that channel. | Not implemented |
| `volume` | Controls playback volume. | Not implemented |
| `volumescale` | Scales the effective volume. | Not implemented |
| `pan` | Applies relative stereo positioning. | Not implemented |
| `abspan` | Applies absolute stereo positioning. | Not implemented |
| `freqmul` | Changes playback frequency/rate. | Not implemented |
| `loop` | Keeps the sample playing until stopped or replaced. | Not implemented |

## Planned runtime flow

```text
CNS PlaySnd controller
  ↓ evaluate expressions at the firing frame
Sound event snapshot
  ↓ resolve owner CharacterAssets / SND group,index
Owner-scoped audio channel table
  ↓
Web Audio adapter
```

The playback channel must be scoped by owner entity. P1 channel 0 and P2 channel 0 must not collide. The same design must remain usable when Helper and Projectile owners are introduced.

## Required diagnostics

Successful playback should be traceable in Runtime History:

```text
raw.sound_play owner=p1 sample=2,5 channel=0
  volume=100 pan=0 freqmul=1 loop=0
  result=started voiceId=87
```

Failure must also be explicit:

```text
raw.sound_play_rejected owner=p1 sample=2,5 reason=sample_not_found
```

Other expected rejection reasons include `audio_locked`, `decode_failed`, and `sound_asset_missing`.

## Completion criteria

`PlaySnd` is not complete until:

- the character SND archive is loaded from DEF/ZIP assets;
- `value` expressions select a real sample;
- playback occurs through one reusable AudioContext;
- owner-scoped channel replacement works;
- volume, pan, frequency and loop behavior are covered to the documented extent;
- focused tests and runtime diagnostics exist;
- the Compatibility Matrix and this document reflect the same status.

See [GitHub Issue #28](https://github.com/yshtysht8sh10-glitch/WebMUGEN/issues/28) for implementation work and acceptance criteria.
