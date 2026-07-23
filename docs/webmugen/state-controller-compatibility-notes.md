# State Controller Compatibility Notes

Updated: 2026-07-13

This document summarizes State Controller implementation notes. The compatibility matrix remains the source of truth:

- `docs/webmugen/winmugen-compatibility-matrix.html`
- `docs/webmugen/winmugen-compatibility-matrix.md`

Follow `docs/webmugen/development-policy.md`: TypeScript executes MUGEN data; do not turn it into a hidden KFM-specific rulebook.

## Status rule

- **Complete**: implemented and covered by focused tests or confirmed runtime usage.
- **Partial**: safe no-op, placeholder storage, approximate behavior, or incomplete integration.
- **Unsupported**: not implemented.
- **Untested**: implementation may exist but lacks verification.

Recognized safe no-ops are normally **Partial**, not Complete.

## Current controller families

| Family | Examples | Current note |
|---|---|---|
| State transition | `ChangeState`, `SelfState` | `ChangeState` preserves current State ownership. `SelfState` returns borrowed players to their own CNS document. Helper and animation ownership remain Partial. |
| Animation | `ChangeAnim`, `ChangeAnim2` | `ChangeAnim` is Complete for runtime animation selection and evaluates numeric `value` expressions with current player context. `ChangeAnim2` is a safe no-op/Partial until target/common animation behavior exists. |
| Velocity/position | `VelSet`, `VelAdd`, `VelMul`, `PosSet`, `PosAdd` | `VelSet`/`VelAdd` X values are converted from facing-relative CNS coordinates to world velocity when applied. `VelMul` scales that stored world velocity without applying facing again. |
| State flags | `CtrlSet`, `StateTypeSet`, `MoveTypeSet`, `AssertSpecial` | Basic state flags exist. `AssertSpecial noautoturn` suppresses grounded stage auto-facing for the asserted tick and deasserts before the next tick; other AssertSpecial flags remain incomplete. |
| Player collision | `PlayerPush`, `Width` | `PlayerPush = 0` disables separation for its execution frame. Grounded players retain horizontal push; airborne players may cross only after the fixed generic rectangles clear vertically. `Width` is still stored only and AIR `Clsn2`/character width integration remains incomplete. |
| Life/power | `LifeAdd`, `LifeSet`, `PowerAdd`, `PowerSet` | PowerAdd/PowerSet use the shared player-specific 0..`powerMax` clamp and emit mutation diagnostics. Header `poweradd` is tracked separately as a StateDef header field. Helper ownership remains Partial. |
| Vars | `VarSet`, `VarAdd`, `VarRangeSet`, `VarRandom` | Integer vars exist. `VarRandom` is still a deterministic placeholder. |
| Hit-related | `HitDef`, `HitBy`, `NotHitBy`, `HitVelSet`, `HitFallVel`, `HitFallDamage` | `HitDef` evaluates a typed activation snapshot for major fields. Normal and guard damage/pause/hit time/velocity, guard control/kill, ground/air reaction, fall/recover data, and basic down time reach live common-state paths. Advanced guard/fall/down behavior remains Partial. |
| Target-related | `TargetState`, `TargetVelSet`, `TargetLifeAdd`, etc. | TargetState records the controller owner and executes that owner's CNS; Projectile hits now acquire the same generic Target and SelfState returns it to its own CNS. Other registered-target mutations remain connected. Persistent TargetBind, Helper/multi-player lookup, animation ownership, and secondary parameters remain incomplete. |
| Helper/Projectile/Explod | `Helper`, `Projectile`, `Explod`, `ModifyExplod`, `RemoveExplod`, `ExplodBindTime` | Helpers execute independent States and active Helper HitDefs now collide with the opposing root, applying reaction/effects while retaining Helper-local MoveHit/Target state. Projectile creation, motion/acceleration, owner-AIR rendering, contact, damage/removal, ProjHit history, and normal-hit Target acquisition are production-connected; full interaction/animation/pause semantics remain Partial. Explod create/render/lifecycle, explicit-ID mutations, motion/render extensions, owner-hit removal, Pause gating, and isolated HitDef spark entries are production-connected. Helper-as-defender/Helper-vs-Helper combat, common fightfx assets, ownpal isolation, destination/subtractive blend, shadow pass, and broader non-player ownership remain Partial. |
| Visual/audio effects | `AfterImage`, `BGPalFX`, `PalFX`, `EnvShake`, `PlaySnd`, `StopSnd`, `SndPan`, `Pause`, `SuperPause`, `Trans`, `AngleDraw` | `AfterImage` captures position/facing/Anim history and renders gap-selected frames. `BGPalFX` scopes its timed filter to the background. `EnvShake` evaluates WinMUGEN parameters/defaults and starts shared Canvas shake. Character audio, HitDef sounds, and match-level Pause/SuperPause are production-connected. Exact palette arithmetic, BGPalFX activation during hitpause, common sound archives, same-pass pause ordering, Helper ownership, and exact pan remain Partial. |

## Implementation guidance

Prefer implementing controller semantics generically rather than for a single state or character.

When a behavior can be expressed in CNS/CMD data, prefer using `public/chars/common.cmd` or character data instead of hard-coding in TypeScript.

Good TypeScript controller logic should:

- read controller parameters through the parsed CNS structure;
- evaluate triggers before execution;
- apply only the documented state mutation;
- return whether the controller actually executed;
- expose debug information when a route is under investigation.

## Complete vs Partial examples

`Null` can be Complete because its purpose is explicit no-op behavior.

`AfterImage` remains Partial after visual integration because exact indexed-palette arithmetic and every pause/Helper edge are not yet verified.

`HitDef` remains Partial: major parameters are evaluated once into `ActiveHitDef`, with unapplied and invalid fields diagnosed rather than silently dropped. The live runtime applies normal/guard/fall kill separation, explicit power pairs, numhits combo count, edge-only cornerpush selection, snap, sprite priorities, target class/attr/priority, chain eligibility, repeat prevention, and `hitonce` before entering common reaction states. H/L/M/A/F/D target classes are connected, the legacy `P` suffix is tolerated without changing the class match, and `+`/`-` select already-hit/not-already-hit targets. Required animations are not substituted when absent. mugen.cfg power defaults, camera-relative corner bounds, mixed priority-type edges, full team-mode validation, and broader get-hit integration remain incomplete.

`HitFallDamage` reads the contact-snapshotted `fall.damage` and honors `fall.kill`; the existing common State triggers ensure it executes at the intended landing time. Explicit legacy `value` remains accepted for backward compatibility.

## Test expectations

Controller tests should verify:

- trigger gating;
- parameter parsing;
- before/after player state;
- whether controller execution is reported;
- interaction with state entry when relevant.

Movement-oriented controllers should assert velocity, position, animation, and state transitions directly.
