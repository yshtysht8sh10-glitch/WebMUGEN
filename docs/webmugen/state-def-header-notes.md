# StateDef Header Compatibility Notes

Updated: 2026-07-12

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
| `anim` | Complete | Parsed and applied as initial animation. Animless state preservation exists. | Rendering/animation availability should still be checked per character. |
| `ctrl` | Complete | Parsed and applied as control flag. | State-specific control handoff still depends on controller flow. |
| `poweradd` | Complete | Parsed and applied once on state entry. | Should not be re-applied while staying in the same state. |
| `juggle` | Partial | Parsed as the active attack State cost and consumed from the airborne target's `[Data] airjuggle` pool on accepted HitDef contact. | Helper/projectile/team pools and advanced reset flags remain incomplete. |
| `facep2` | Complete | Parsed and applied on state entry; Debug Overlay exposes facing. | Edge cases with custom states/helpers still need verification. |
| `hitdefpersist` | Partial | Entering a State with value 1 preserves the ActiveHitDef, its consumed-target generation history, and used flag; value 0 discards them. | Helper/projectile and multi-player HitDef ownership remain incomplete. |
| `movehitpersist` | Partial | Entering a State with value 1 preserves MoveContact/MoveHit/MoveGuarded result flags; value 0 resets them independently of the hit count. | MoveReversed and multi-player result semantics remain incomplete. |
| `hitcountpersist` | Partial | Entering a State with value 1 preserves HitCount; value 0 resets it independently of the move-contact result. | UniqHitCount and full team/combo-counter semantics remain incomplete. |
| `sprpriority` | Partial | Runtime field exists. | Rendering order still needs audit. |

## Implementation guidance

StateDef header fields should be applied when entering a state through `ChangeState`, `SelfState`, or equivalent centralized state-entry logic.

Do not apply entry-only fields every frame while the player remains in the same state. `poweradd` is the key example: it should add power once at state entry, not once per tick.

Fields that only store compatibility data but do not yet affect the full subsystem should remain **Partial** in the matrix.

## Test expectations

Focused tests should verify:

- parser reads the field correctly;
- state entry applies the field;
- staying in the same state does not reapply entry-only effects;
- Debug Overlay exposes runtime values when useful.

Good test assertions include `stateNo`, `stateType`, `moveType`, `physics`, `ctrl`, `animNo`, `facing`, `power`, attack `juggle`, and defender `juggleRemaining`/`juggleMax`.
