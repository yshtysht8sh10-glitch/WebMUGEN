# StateDef Header Compatibility Notes

Updated: 2026-07-16

This document summarizes implementation notes for StateDef header fields. The compatibility matrix remains the source of truth:

- `docs/webmugen/winmugen-compatibility-matrix.html`
- `docs/webmugen/winmugen-compatibility-matrix.md`

Follow `docs/webmugen/development-policy.md`: do not modify `public/chars/common1.cns`; fix parser/runtime/physics/debug behavior instead.

## Current support summary

| Field | Matrix status | Implementation note | Remaining risk |
|---|---|---|---|
| `type` | Complete | Parsed and applied to `stateType`. | None known for simple states. |
| `movetype` | Complete | Parsed and applied to `moveType`. | Full attack/hit semantics depend on HitDef subsystem. |
| `physics` | Partial | Parsed and applied. Runtime physics behavior is still incomplete. | Air/stand/crouch physics need broader WinMUGEN verification. |
| `anim` | Complete | Parsed and applied once as the initial animation on State entry. An explicit value restarts at time zero even when its number matches the current animation; omission preserves the current animation and time. Runtime expressions such as `6142 + IfElse(...)` are evaluated on entry; later `ChangeAnim` selections persist instead of being overwritten by the StateDef header on following ticks. Non-finite results preserve the prior animation. | Rendering/animation availability should still be checked per character. |
| `velset` | Partial | Numeric X/Y pairs apply once on State entry before controllers; X is converted from Facing-relative CNS velocity. | Expression-valued header components and broader real-character coverage remain to audit. |
| `ctrl` | Complete | Parsed and applied as control flag. | State-specific control handoff still depends on controller flow. |
| `poweradd` | Complete | Parsed, applied once on state entry, and clamped through the player's 0..`powerMax` mutation path. | Helper ownership remains tied to the future Helper runtime. |
| `juggle` | Partial | Parsed as the attack-chain cost and consumed once per airborne target. Directly continued attack States without an explicit value inherit the paid chain; a new explicit value starts a new chain. | Helper/projectile/team pools and advanced reset flags remain incomplete. |
| `facep2` | Complete | Parsed and applied on state entry; Debug Overlay exposes facing. | Edge cases with custom states/helpers still need verification. |
| `hitdefpersist` | Partial | Entering a State with value 1 preserves the ActiveHitDef, its consumed-target generation history, and used flag; value 0 discards them. | Helper/projectile and multi-player HitDef ownership remain incomplete. |
| `movehitpersist` | Partial | Entering a State with value 1 preserves MoveContact/MoveHit/MoveGuarded result flags; value 0 resets them independently of the hit count. | MoveReversed and multi-player result semantics remain incomplete. |
| `hitcountpersist` | Partial | Entering a State with value 1 preserves HitCount; value 0 resets it independently of the move-contact result. | UniqHitCount and full team/combo-counter semantics remain incomplete. |
| `sprpriority` | Partial | Runtime field exists. | Rendering order still needs audit. |

## Implementation guidance

StateDef header fields should be applied when entering a state through `ChangeState`, `SelfState`, or equivalent centralized state-entry logic. Direct engine entry into a common get-hit State applies entry fields on its first active CNS frame after hit pause.

Expression-valued `anim` headers are retained by the parser and evaluated against the entering player's runtime context. This matters when a same-tick ChangeState chain enters an expression-valued StateDef before reaching another State: no intermediate State may write `NaN` into `animNo`.

The StateDef `anim` field is entry-only. Reapplying it while the State remains active would overwrite a controller-selected animation; bundled T-H-M-A State 102 demonstrates this by selecting Anim 107 at Time 0 after entry from State 101.

Entry-only does not mean change-only: an explicitly declared animation starts again at animation time zero even if the previous State used the same animation number. This lets T-H-M-A State 281 remain active long enough for the attacker's State -1 to observe `P2StateNo = 281` and create its wall Explod and sound Helper after an extended State 280 flight.

`velset` changes live `vx`/`vy` only. It does not overwrite `hitVelX`/`hitVelY` or the `GetHitVar` snapshot. This distinction is required by State 5000: `velset = 0,0` freezes the shake while `GetHitVar(yvel)` can still classify the later ground/air route and `HitVelSet` can restore selected components.

Do not apply entry-only fields every frame while the player remains in the same state. `poweradd` is the key example: it should add power once at state entry, not once per tick.

Fields that only store compatibility data but do not yet affect the full subsystem should remain **Partial** in the matrix.

## Test expectations

Focused tests should verify:

- parser reads the field correctly;
- state entry applies the field;
- staying in the same state does not reapply entry-only effects;
- Debug Overlay exposes runtime values when useful.

Good test assertions include `stateNo`, `stateType`, `moveType`, `physics`, `ctrl`, `animNo`, `facing`, `power`, attack `juggle`, and defender `juggleRemaining`/`juggleMax`.
