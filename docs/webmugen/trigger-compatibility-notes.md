# Trigger Compatibility Notes

Updated: 2026-07-06

This document summarizes Trigger implementation notes. The compatibility matrix remains the source of truth:

- `docs/webmugen/winmugen-compatibility-matrix.html`
- `docs/webmugen/winmugen-compatibility-matrix.md`

Follow `docs/webmugen/development-policy.md`: implement triggers one item at a time and keep matrix status conservative.

## Status rule

- **Complete** means the trigger has focused tests or a confirmed runtime integration path.
- **Partial** means simple cases, approximations, safe defaults, or incomplete subsystem integration.
- **Unsupported** means no meaningful implementation exists.
- **Untested** means implementation may exist but has not been verified.

Do not mark safe defaults as Complete.

## Recently touched trigger areas

| Trigger | Matrix status | Current note | Remaining risk |
|---|---|---|---|
| `BodyDist X` | Partial | Evaluates opponent center distance like `P2BodyDist X`. | Precise body-edge width and push/collision integration are incomplete. |
| `BodyDist Y` | Partial | Evaluates opponent/player Y coordinate difference like `P2BodyDist Y`. | Precise body-edge height and airborne body bounds need audit. |
| `AnimExist` | Partial | Uses runtime animation lookup when provided. | AIR ownership, redirect behavior, and missing animation edge cases need audit. |
| `SelfAnimExist` | Partial | Uses runtime self-animation lookup when provided. | Redirect-specific AIR ownership and helper/custom-state behavior need audit. |
| `AnimElemNo` | Partial | Uses runtime animation element lookup when provided. | AIR timing edge cases and exact WinMUGEN element numbering need audit. |
| `Command` | Complete | Basic command set matching works. | CMD syntax/timing remains partially covered elsewhere. |
| `StateNo` | Complete | Numeric state comparison. | None known for simple comparisons. |
| `StateType` | Complete | Basic S/C/A/L comparison. | State header correctness still matters. |
| `Ctrl` | Complete | Basic control-flag comparison. | Control handoff semantics depend on state/controller flow. |
| `Time` | Complete | State time comparison. | Previous-state and transition timing still need broader route tests. |
| `MoveContact` / `MoveHit` / `MoveGuarded` / `HitCount` | Partial | Reads ActiveHitDef-generation contact/hit/guard flags and State-local hit count; live normal and guarded routes are tested. | Persist headers and Helper/projectile parity remain incomplete. |
| `HitDefAttr` | Partial | Compares requested State/category sets with the normalized ActiveHitDef attr shared by HitBy/NotHitBy collision filtering. | Redirect and malformed multi-attr edge cases remain incomplete. |
| `GetHitVar` | Partial | Reads a contact snapshot for damage, hit/slide/control time, velocities, type/animation codes, fall values, ids, guarded, and yaccel across get-hit State changes. | Offset/fall-time keys and later guard/fall semantics still use diagnosed safe defaults. |
| `NumTarget` / `TargetID` / `TargetStateNo` | Partial | Reads a multi-entry attacker Target list, supports HitDef id filtering, and returns current two-player target State. | Helper/multi-player lookup and Target redirect chains remain incomplete. |
| Projectile triggers | Partial / Unsupported | Some `Proj*Time` safe defaults exist; boolean projectile triggers are incomplete. | Requires projectile subsystem integration. |

## Trigger group policy

MUGEN trigger groups must preserve the `triggerall` AND plus `triggerN` OR model:

- all `triggerall` expressions must pass;
- at least one numbered group must pass;
- all expressions inside a numbered group must pass.

When debugging, expose:

- each `triggerall` result;
- each `triggerN` group result;
- final `shouldRun` result;
- controller execution result.

This is especially important for command routes such as crouch, walk, jump, and attacks.

## Expression evaluator notes

The matrix currently tracks expression features separately from triggers. Keep those separate.

For example, adding math support for `+`, `-`, `*`, `/`, `%`, `Sin`, `Cos`, or `IfElse` should update Expression rows, not arbitrary Trigger rows.

## Test expectations

Trigger tests should verify both positive and negative cases when possible.

A good trigger test includes:

- player state before evaluation;
- command set or opponent context if relevant;
- expected boolean result;
- at least one negative assertion for approximated triggers.

For animation-related triggers, tests should include both existing and missing animation/action cases.
