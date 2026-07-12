# HitDef Real-Character Regression

Updated: 2026-07-13

This is the evidence record for GitHub Issue #23. It does not claim complete WinMUGEN combat compatibility; it records which real-character paths were exercised and which limitations remain Partial or Unsupported in the canonical Matrix.

## Character set

| Character | Source used for the audit | Structural evidence |
|---|---|---|
| Kung Fu Man (Elecbyte) | Bundled `public/chars/kfm/kfm.def` | 25 HitDefs, 11 Target controllers, 3 custom-State fields, and a MoveHit/MoveContact reference. |
| T-H-M-A (Yes) | Bundled multi-CNS `public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def` | 90 HitDefs, 99 Target controllers, 12 custom-State fields, and 310 hit-confirm references across multiple State files. |
| Yes030_e-rada | Existing local WinMUGEN installation outside this repository | 46 HitDefs, 18 Target controllers, 4 custom-State fields, and 83 hit-confirm references. No character asset was copied into or redistributed with WebMUGEN. |

The third path is supplied through an environment variable, so the repository does not hard-code a developer-machine path or redistribute external character data.

## Reproducible harness

`src/core/character/RealCharacterHitDefRegression.test.ts` accepts three or more `.def` paths through `WEBMUGEN_REAL_CHARACTER_DEFS`, separated by the operating-system path delimiter. It:

1. loads every character through the production CharacterLoader;
2. verifies real HitDef controllers and AIR Clsn1 data;
3. forces one existing suitable HitDef controller to activation without rewriting its parameters;
4. uses the same character's AIR Clsn1/Clsn2 elements for contact;
5. runs ground, air, guard, KO, both Facing directions, screen-edge contact, and P1/P2 reversal;
6. follows diagnostics from `raw.hitdef_activate` through collision, damage, reaction, and hit-stun `event=end`;
7. inventories real controllers and HitDef parameter names against both Matrix mirrors;
8. checks aggregate Light/Medium/Hard, air hit, multihit, hit-confirm, guard, fall/down, juggle, Target, custom-State, and KO structures.

Example PowerShell command:

```powershell
$env:WEBMUGEN_REAL_CHARACTER_DEFS='D:\path\char1.def;D:\path\char2.def;D:\path\char3.def'
npm test -- --run src/core/character/RealCharacterHitDefRegression.test.ts
```

With fewer than three configured paths, the external-asset suite is skipped instead of pretending bundled KFM/T-H-M-A satisfy the gate. The ordinary suite remains self-contained.

## 2026-07-13 result

- Three characters loaded through the production loader.
- P1 and P2 completed ground, air, guard, KO, edge, and left/right Facing contact/recovery traces using real HitDef maps and AIR collision elements.
- External suite: 1 file / 3 tests passed.
- Aggregate multihit, hit-confirm cancel, down/recovery, juggle, Target, and custom-State structural gates passed.
- Matrix audit found and corrected a missing `FallEnvShake` controller row.
- Matrix audit added one row per HitDef parameter observed in the three characters; approximations and no-ops were not promoted to Complete.
- The audit exposed T-H-M-A `TimeMod = 7, 3` as a real unsupported route; StateTime/TimeMod compatibility and focused positive/negative tests were added.
- `public/chars/common1.cns` was unchanged.

Focused engine tests from Issues #3-#22 remain the behavioral evidence for multihit/chain persistence, Target mutation, custom-State ownership, guard/down/recovery, juggle, KO, power, cornerpush, snap, effects, and diagnostics. This harness proves those layers accept multiple real WinMUGEN data layouts and are not tied to KFM State numbers.

## Known constraints

- The harness forces an existing HitDef controller's trigger true to isolate HitDef/AIR/runtime compatibility. It does not claim every original CMD or AI route is playable end-to-end.
- `mugen.cfg`-derived default power gain is unavailable; explicit power pairs are tested.
- Camera-relative cornerpush, team/Helper/projectile parity, full throw/custom animation ownership, fightfx/SND playback, palette effects, and legacy aliases remain Partial or Unsupported per Matrix.
- Real Target/custom-State/multihit structures are inventoried here and their generic runtime behavior is covered by focused tests; exhaustive character-specific cinematics and AI routes are outside this Issue.
- The normal build remains blocked before compilation by known TS5107 configuration. The full Vitest suite is the regression gate.
