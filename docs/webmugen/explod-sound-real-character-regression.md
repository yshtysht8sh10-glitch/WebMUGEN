# Explod / Sound Real-Character Regression

Updated: 2026-07-13

This is the evidence record for GitHub Issue #37. It verifies production Explod and Sound boundaries with multiple WinMUGEN characters without promoting Partial behavior merely because real data contains it.

## Character set and observed controllers

| Character | Source | Explod | Modify | Remove | BindTime | PlaySnd | StopSnd | SndPan | Pause | SuperPause |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Kung Fu Man | bundled `public/chars/kfm/kfm.def` | 3 | 0 | 0 | 0 | 27 | 0 | 0 | 1 | 1 |
| T-H-M-A | bundled multi-CNS/ZIP character | 370 | 0 | 44 | 0 | 357 | 12 | 0 | 30 | 17 |
| Yes030_e-rada | external local WinMUGEN installation | 245 | 11 | 31 | 0 | 65 | 0 | 0 | 0 | 6 |

The external asset is loaded by path and is not copied into this repository. The profiles are structurally distinct. Absence is not an Unsupported claim: ExplodBindTime and SndPan remain focused-fixture verified but have no evidence in this character set.

## Reproducible harness

`src/core/character/RealCharacterExplodSoundRegression.test.ts` accepts at least three `.def` paths through `WEBMUGEN_REAL_CHARACTER_DEFS`. It loads every character through `CharacterLoader`, selects a real character-scope SND sample and owner AIR Explod action, then forces only that existing controller trigger for deterministic isolation.

```powershell
$env:WEBMUGEN_REAL_CHARACTER_DEFS='public/chars/kfm/kfm.def;public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def;D:/working/MUGEN/Char/Yes030_e-rada/Yes030_e-rada.def'
npm test -- --run src/core/character/RealCharacterExplodSoundRegression.test.ts
```

The harness verifies production CNS/SND lookup, Explod GameState/AIR renderer resolution, P1/P2, both Facings, individual Matrix rows, 600 lifecycle ticks per character without entry growth, and clean runtime collection boundaries.

Companion focused gates cover bundled T-H-M-A ZIP loading; Modify/Remove/BindTime/motion/pause/HitDef effects; channel replacement, StopSnd, SndPan, loop and natural end; 240-voice Audio cleanup; round reset; repeated play/static tabs with one canvas; and Runtime History reasons.

## 2026-07-13 result

- External Explod/Sound harness: 1 file / 4 tests passed.
- Combined focused gate: 4 files / 23 tests passed.
- All three characters resolved real PlaySnd samples and visible owner Explods for P1/P2 and both Facings.
- Long lifecycle completed 1,800 real AIR ticks without entry growth.
- T-H-M-A ZIP loaded without fallback and exposed real Explod/PlaySnd controllers.
- Audio stress released all 240 handles and closed its sole adapter.
- No new engine regression, KFM-specific code, or compatibility asset edit was required.

## Known constraints

- Controllers are trigger-forced to isolate the runtime boundary; this is not a claim that every original CMD/AI route was played.
- None of the three characters uses ExplodBindTime or SndPan. Their Partial evidence remains neutral production fixtures.
- Only T-H-M-A uses StopSnd and only Yes030_e-rada uses ModifyExplod in this set.
- Common fightfx AIR/SFF/SND is not bundled. Common/`F` selection remains diagnosed Partial.
- Omitted ids, Helper ownership, exact pan, palette isolation, destination/subtractive blend, and shadow rendering remain Partial.
- The normal build remains blocked before compilation by known TS5107; Vitest and direct Vite build remain executable gates.
