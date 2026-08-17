# StateDef Header Compatibility Notes

Updated: 2026-08-12

This document summarizes implementation notes for StateDef header fields. The compatibility matrix remains the source of truth:

- `docs/webmugen/winmugen-compatibility-matrix.html`
- `docs/webmugen/winmugen-compatibility-matrix.md`

Follow `docs/webmugen/development-policy.md`: do not modify `public/chars/common1.cns`; fix parser/runtime/physics/debug behavior instead.

## Current support summary

| Field | Matrix status | Implementation note | Remaining risk |
|---|---|---|---|
| `type` | Complete | Parsed and applied once on State entry. A later `StateTypeSet` override persists for the remainder of that State. | None known for simple states. |
| `movetype` | Complete | Parsed and applied to `moveType`. Omission uses WinMUGEN's `I` default; explicit `U` alone preserves the preceding MoveType. This applies both to centralized transitions and the first CNS pass after external state entry. | Full attack/hit semantics depend on HitDef subsystem. |
| `physics` | Partial | Parsed and applied once on State entry. A later `StateTypeSet physics` override persists for the remainder of that State. Runtime physics behavior is still incomplete. | Air/stand/crouch physics need broader WinMUGEN verification. |
| `anim` | Complete | Parsed and applied once as the initial animation on State entry. An explicit value restarts at time zero even when its number matches the current animation, including externally entered HitDef `p1stateno`/`p2stateno` States; omission preserves the current animation and time. Runtime expressions such as `6142 + IfElse(...)` are evaluated on entry, including external HitOverride entry into T-H-M-A State 902 with `Random % 3`; later `ChangeAnim` selections persist instead of being overwritten by the StateDef header on following ticks. Bundled itoko State 700→710 verifies that Anim 700 time 18 is not inherited by the throw animation. Non-finite results preserve the prior animation. | Rendering/animation availability should still be checked per character. |
| `velset` | Partial | Numeric X/Y pairs apply once on State entry before controllers; X is converted from Facing-relative CNS velocity. | Expression-valued header components and broader real-character coverage remain to audit. |
| `ctrl` | Complete | Parsed and applied on State entry after any `ChangeState ctrl` transition value, so an explicit destination header wins in the same frame; omission inherits the controller value. Focused T-H-M-A State 6000 -> 60001 coverage blocks State 20/11 input routing. | State-specific control handoff still depends on later `CtrlSet` flow. |
| `poweradd` | Complete | Parsed, applied once on state entry, and clamped through the player's 0..`powerMax` mutation path. | Helper ownership remains tied to the future Helper runtime. |
| `juggle` | Partial | Parsed as the attack-chain cost and consumed once per airborne target. Directly continued attack States without an explicit value inherit the paid chain; a new explicit value starts a new chain. | Helper/projectile/team pools and advanced reset flags remain incomplete. |
| `facep2` | Complete | Parsed and applied on state entry; zero preserves incoming Facing and one faces the opponent. Separately, Stage AutoTurn applies only while grounded with `MoveType = I` in common idle State 0/11 and starts Anim 5/6 while retaining Ctrl; other States preserve Facing. `noautoturn` and pause freezes are respected. Debug Overlay exposes facing. | Helper-specific AutoTurn behavior still needs verification. |
| `hitdefpersist` | Partial | Entering a State with value 1 preserves the ActiveHitDef, its consumed-target generation history, and used flag; value 0 discards them. | Helper/projectile and multi-player HitDef ownership remain incomplete. |
| `movehitpersist` | Partial | Entering a State with value 1 preserves MoveContact/MoveHit/MoveGuarded result flags; value 0 resets them independently of the hit count. | MoveReversed and multi-player result semantics remain incomplete. |
| `hitcountpersist` | Partial | Entering a State with value 1 preserves HitCount; value 0 resets it independently of the move-contact result. | UniqHitCount and full team/combo-counter semantics remain incomplete. |
| `sprpriority` | Partial | Numeric header values apply once on State entry to roots and Helpers; omission preserves the preceding priority. Canvas interleaves Player/Helper and normal Explod sprites from lower to higher priority, while `ontop = 1` Explods remain in the later top pass. At equal priority, newer Helper/Explod objects render behind older roots; bundled T-H-M-A State 3640 therefore keeps its full-screen Action 3603 background behind its Action 3640 player. State 3930 verifies its `-1` portrait behind both players, its player priority `2`, and accent Explods at `3`/`4`. | Projectile `projsprpriority`, exact Helper-versus-Explod tie ordering, and every foreground/HUD interaction remain to audit. |

## Implementation guidance

StateDef header fields should be applied when entering a state through `ChangeState`, `SelfState`, or equivalent centralized state-entry logic. Direct engine entry into a common get-hit State applies entry fields on its first active CNS frame after hit pause.

StateDef `movetype` is not an ordinary inherited field. When it is omitted, WinMUGEN defaults it to `I`; only an explicit `U` leaves the preceding MoveType unchanged. This distinction lets an attack return to a State 0 that omits `movetype` and become eligible for normal idle AutoTurn instead of remaining incorrectly classified as attacking.

Expression-valued `anim` headers are retained by the parser and evaluated against the entering player's runtime context. This matters when a same-tick ChangeState chain enters an expression-valued StateDef before reaching another State: no intermediate State may write `NaN` into `animNo`.

The StateDef `anim` field is entry-only. Reapplying it while the State remains active would overwrite a controller-selected animation; bundled T-H-M-A State 102 demonstrates this by selecting Anim 107 at Time 0 after entry from State 101.

Entry-only does not mean change-only: an explicitly declared animation starts again at animation time zero even if the previous State used the same animation number. The same rule applies on the first CNS pass after an external HitDef custom-State transition. It lets itoko's `p1stateno = 710` play the full throw instead of inheriting State 700's `AnimTime = 18`, and lets T-H-M-A State 281 remain active long enough for the attacker's State -1 to observe `P2StateNo = 281` and create its wall Explod and sound Helper after an extended State 280 flight.

`velset` changes live `vx`/`vy` only. It does not overwrite `hitVelX`/`hitVelY` or the `GetHitVar` snapshot. This distinction is required by State 5000: `velset = 0,0` freezes the shake while `GetHitVar(yvel)` can still classify the later ground/air route and `HitVelSet` can restore selected components.

Do not apply entry-only fields every frame while the player remains in the same state. `poweradd` is the key example: it should add power once at state entry, not once per tick.
The same entry boundary applies to `type`, `physics`, and `juggle`; reapplying those headers would
erase live State Controller changes. Bundled T-H-M-A State 3410 depends on its Time=0
`StateTypeSet type=A` remaining active until the airborne miss reaches the front edge and exits.

Fields that only store compatibility data but do not yet affect the full subsystem should remain **Partial** in the matrix.

## Test expectations

Focused tests should verify:

- parser reads the field correctly;
- state entry applies the field;
- staying in the same state does not reapply entry-only effects;
- Debug Overlay exposes runtime values when useful.

Good test assertions include `stateNo`, `stateType`, `moveType`, `physics`, `ctrl`, `animNo`, `facing`, `power`, attack `juggle`, and defender `juggleRemaining`/`juggleMax`.
