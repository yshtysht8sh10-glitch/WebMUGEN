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
| State flags | `CtrlSet`, `StateTypeSet`, `MoveTypeSet` | Basic behavior exists. |
| Player collision | `PlayerPush`, `Width` | `PlayerPush = 0` disables separation for its execution frame. Grounded players retain horizontal push; airborne players may cross only after the fixed generic rectangles clear vertically. `Width` is still stored only and AIR `Clsn2`/character width integration remains incomplete. |
| Life/power | `LifeAdd`, `LifeSet`, `PowerAdd`, `PowerSet` | Basic behavior exists. Header `poweradd` is tracked separately as a StateDef header field. |
| Vars | `VarSet`, `VarAdd`, `VarRangeSet`, `VarRandom` | Integer vars exist. `VarRandom` is still a deterministic placeholder. |
| Hit-related | `HitDef`, `HitBy`, `NotHitBy`, `HitVelSet`, `HitFallVel`, `HitFallDamage` | `HitDef` evaluates a typed activation snapshot for major fields. Normal and guard damage/pause/hit time/velocity, guard control/kill, ground/air reaction, fall/recover data, and basic down time reach live common-state paths. Advanced guard/fall/down behavior remains Partial. |
| Target-related | `TargetState`, `TargetVelSet`, `TargetLifeAdd`, etc. | TargetState records the controller owner and executes that owner's CNS; SelfState can return the target. Other registered-target mutations remain connected. Persistent TargetBind, Helper/multi-player lookup, animation ownership, and secondary parameters remain incomplete. |
| Helper/Projectile/Explod | `Helper`, `Projectile`, `Explod`, `ModifyExplod`, `RemoveExplod`, `ExplodBindTime` | Explod creation, owner AIR/SFF rendering, age/AnimElem/time, removetime, bind release, round cleanup, and explicit-ID ModifyExplod partial updates are production-connected with diagnostics. Omitted ModifyExplod id selection, movement/pause integration, RemoveExplod, and ExplodBindTime remain Partial; see `explod-integration-design.md`. |
| Visual/audio effects | `AfterImage`, `PalFX`, `EnvShake`, `PlaySnd`, `StopSnd`, `SndPan`, `Trans`, `AngleDraw` | Character PlaySnd playback, StopSnd stopping, and SndPan live owner/channel updates are production-connected. Common sound/Helper ownership, omitted StopSnd channel, exact pan mapping, and adapters without StereoPanner remain Partial. Other visual effects are mostly safe no-op or field storage. |

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

`AfterImage` should remain Partial if it is only recognized and skipped, because the visual effect is not implemented.

`HitDef` remains Partial: major parameters are evaluated once into `ActiveHitDef`, with unapplied and invalid fields diagnosed rather than silently dropped. The live runtime applies normal/guard/fall kill separation, explicit power pairs, numhits combo count, edge-only cornerpush selection, snap, sprite priorities, target class/attr/priority, chain eligibility, repeat prevention, and `hitonce` before entering common reaction states. Required animations are not substituted when absent. mugen.cfg power defaults, camera-relative corner bounds, hitflag modifiers, mixed priority-type edges, full team-mode validation, and broader get-hit integration remain incomplete.

`HitFallDamage` reads the contact-snapshotted `fall.damage` and honors `fall.kill`; the existing common State triggers ensure it executes at the intended landing time. Explicit legacy `value` remains accepted for backward compatibility.

## Test expectations

Controller tests should verify:

- trigger gating;
- parameter parsing;
- before/after player state;
- whether controller execution is reported;
- interaction with state entry when relevant.

Movement-oriented controllers should assert velocity, position, animation, and state transitions directly.
