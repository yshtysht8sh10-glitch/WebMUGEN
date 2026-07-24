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

## 2026-07-16 Common State chain audit

Issue #63 expands the self-contained T-H-M-A State 215 regression from two nonlethal cases to five production-loader/AIR chains: grounded P1/right, airborne P2/left, edge/opposite Facing, and lethal P1/P2 routes. Nonlethal cases reach State 5120 and State 0; lethal cases traverse the same common fall/down states, reach State 5150 without recovery, and produce the correct RoundState winner. The focused file reports 5 passed and 3 optional external-asset tests skipped when `WEBMUGEN_REAL_CHARACTER_DEFS` is absent.

This audit also supplies real animation timing callbacks used by the app, rather than treating AnimTime/SelfAnimExist as synthetic defaults. `public/chars/common1.cns` remains unchanged.

## 2026-07-21 State 215 collision-frame regression

The production frame sequence now keeps the CNS animation snapshot for Clsn lookup after physics
updates position and increments `AnimTime`. A focused bundled T-H-M-A test runs the original
`AnimElem = 4` HitDef without forcing its trigger: Action 215 element 4 first rejects collision while
the HitDef is inactive, then the following CNS pass activates HitDef ID 215 and resolves contact
against that same element's two Clsn1 boxes. This closes the former one-frame split where element 4
reported `active_hitdef_missing` and element 5 reported `clsn1_missing`.

## 2026-07-22 State 200 hit-confirm regression

The bundled T-H-M-A production route now verifies that an `a` command entered during State 200's
eight-tick attacker hit pause survives until CNS execution resumes. On that first active tick,
State -1 observes both the retained command and the live `MoveContact` result and enters the close
State 232 cancel. The regression uses the production AIR timing callbacks and the original CMD/CNS
data; no character asset was modified.

## 2026-07-22 crouching/jumping Y hitflag regression

Bundled T-H-M-A States 410 and 610 use `hitflag = MAFP` for their four original HitDefs. The live
eligibility filter now tolerates the legacy `P` suffix and continues to apply the documented
`M/A/F` target classes, instead of rejecting the complete HitDef as `unsupported_hitflag`. Focused
production-data coverage verifies the first Clsn/HitDef frame of both crouching Y and jumping Y
against a standing target without modifying the character assets.

## 2026-07-22 State 700 throw modifier regression

Bundled T-H-M-A State 700 uses `hitflag = M-`, `p1stateno = 701`, and `p2stateno = 711`.
The production-loader/AIR regression forces only the original HitDef trigger, finds a real Clsn
contact, verifies that `-` accepts the neutral target, and confirms entry into both custom throw
States. It also removes State 711 from the defender-owned test document and verifies that omitted
`p2getp1state` uses its WinMUGEN default of 1: the defender records the attacker as State owner and
executes the attacker's State 711 header (`A/H/N`, Anim 5012). Focused synthetic coverage verifies
the omitted default, explicit `p2getp1state = 0` and `1`, and that `-` rejects an already-hit target
while `+` requires one.

Focused engine tests from Issues #3-#22 remain the behavioral evidence for multihit/chain persistence, Target mutation, custom-State ownership, guard/down/recovery, juggle, KO, power, cornerpush, snap, effects, and diagnostics. This harness proves those layers accept multiple real WinMUGEN data layouts and are not tied to KFM State numbers.

## Known constraints

- The harness forces an existing HitDef controller's trigger true to isolate HitDef/AIR/runtime compatibility. It does not claim every original CMD or AI route is playable end-to-end.
- `mugen.cfg`-derived default power gain is unavailable; explicit power pairs are tested.
- T-H-M-A State 200 additionally verifies expression-valued attacker-scoped hit/guard sparks (`16100`/`16000`) and sounds (`200,0`/`645,1`) through production Explod and Browser Audio event bridges.
- Camera-relative cornerpush, team/Helper/full-projectile parity, full throw/custom animation ownership, bundled common fightfx/SND assets, palette effects, and legacy aliases remain Partial or Unsupported per Matrix.
- Real Target/custom-State/multihit structures are inventoried here and their generic runtime behavior is covered by focused tests; exhaustive character-specific cinematics and AI routes are outside this Issue.
- The normal build remains blocked before compilation by known TS5107 configuration. The full Vitest suite is the regression gate.
