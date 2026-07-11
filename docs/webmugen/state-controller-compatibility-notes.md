# State Controller Compatibility Notes

Updated: 2026-07-11

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
| State transition | `ChangeState`, `SelfState` | `ChangeState` is basic Complete. `SelfState` is Partial because full custom-state ownership semantics are incomplete. |
| Animation | `ChangeAnim`, `ChangeAnim2` | `ChangeAnim` is Complete for runtime animation selection and evaluates numeric `value` expressions with current player context. `ChangeAnim2` is a safe no-op/Partial until target/common animation behavior exists. |
| Velocity/position | `VelSet`, `VelAdd`, `VelMul`, `PosSet`, `PosAdd` | Basic numeric behavior exists and is matrix-tracked. |
| State flags | `CtrlSet`, `StateTypeSet`, `MoveTypeSet` | Basic behavior exists. |
| Player collision | `PlayerPush`, `Width` | `PlayerPush = 0` disables fallback stage separation. Push uses a fixed generic rectangle with vertical overlap; `Width` is still stored only and AIR `Clsn2`/character width integration remains incomplete. |
| Life/power | `LifeAdd`, `LifeSet`, `PowerAdd`, `PowerSet` | Basic behavior exists. Header `poweradd` is tracked separately as a StateDef header field. |
| Vars | `VarSet`, `VarAdd`, `VarRangeSet`, `VarRandom` | Integer vars exist. `VarRandom` is still a deterministic placeholder. |
| Hit-related | `HitDef`, `HitBy`, `NotHitBy`, `HitVelSet`, `HitFallVel`, `HitFallDamage` | Mostly Partial because full HitDef/get-hit semantics are incomplete. |
| Target-related | `TargetState`, `TargetVelSet`, `TargetLifeAdd`, etc. | Mostly recognized safe no-ops. True target list and custom-state mutation are incomplete. |
| Helper/Projectile/Explod | `Helper`, `Projectile`, `Explod`, `ModifyExplod`, `RemoveExplod` | CNS runtime recognition exists as Partial; full subsystem behavior must be implemented separately. |
| Visual/audio effects | `AfterImage`, `PalFX`, `EnvShake`, `PlaySnd`, `Trans`, `AngleDraw` | Mostly Partial safe no-op or field storage. Rendering/audio integration incomplete. |

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

`HitDef` should remain Partial if the parser or minimal runtime path exists but true WinMUGEN hit resolution, move contact, target creation, guard, hit pause, and get-hit state integration are incomplete.

## Test expectations

Controller tests should verify:

- trigger gating;
- parameter parsing;
- before/after player state;
- whether controller execution is reported;
- interaction with state entry when relevant.

Movement-oriented controllers should assert velocity, position, animation, and state transitions directly.
