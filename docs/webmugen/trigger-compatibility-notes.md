# Trigger Compatibility Notes

Updated: 2026-07-14

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
| `BodyDist X` | Partial | Compatibility alias of `P2BodyDist X`; measures Facing-relative front-to-front distance using each player's ground/air Size width and XScale. Real T-H-M-A x/a near/far CMD routes are covered. | Team selection, mixed coordinate spaces, and Helper redirects need audit. |
| `BodyDist Y` | Partial | Evaluates opponent/player Y coordinate difference like `P2BodyDist Y`. | Precise body-edge height and airborne body bounds need audit. |
| `BackEdgeBodyDist` | Fallback 40% | The production compiled evaluator selects the edge behind the player from Facing and measures from the fixed X=48/912 fallback boundary; a focused State 250 to 281 route test covers wall impact. | Camera-relative edges and exact body-width adjustment remain incomplete. |
| `FrontEdgeBodyDist` | Fallback 40% | The production compiled evaluator selects the edge in front of the player from Facing and measures from the fixed X=48/912 fallback boundary; a focused State 250 to 281 route test covers wall impact. | Camera-relative edges and exact body-width adjustment remain incomplete. |
| `AnimExist` | Partial | Uses runtime animation lookup when provided. | AIR ownership, redirect behavior, and missing animation edge cases need audit. |
| `SelfAnimExist` | Partial | Uses runtime self-animation lookup when provided. | Redirect-specific AIR ownership and helper/custom-state behavior need audit. |
| `AnimElem` | Complete | Uses 1-based AIR element starts, comparison-time syntax, invalid-element false, and loop re-entry. | Focused trigger/AIR tests and bundled T-H-M-A State 101 PlaySnd regression cover the runtime path. |
| `AnimElemNo` | Partial | Uses runtime animation element lookup when provided. | AIR timing edge cases and exact WinMUGEN element numbering need audit. |
| `AnimElemTime` | Complete | Uses AIR element-relative times shared with `AnimElem`. | Focused positive, negative, and invalid-element tests cover comparison behavior. |
| `Command` | Complete | Basic command set matching works. | CMD syntax/timing remains partially covered elsewhere. |
| `StateNo` | Complete | Numeric state comparison. | None known for simple comparisons. |
| `StateType` | Complete | Basic S/C/A/L comparison. | State header correctness still matters. |
| `Ctrl` | Complete | Bare `Ctrl` and numeric `Ctrl = 1` / `Ctrl = 0` comparisons are covered, including the bundled T-H-M-A State -1 route. | Control handoff semantics depend on state/controller flow. |
| `Time` | Complete | State time comparison. | Previous-state and transition timing still need broader route tests. |
| `Power` / `PowerMax` | Partial | Reads the evaluated P1/P2 player's durable current value and `[Data] power`-derived maximum; focused tests cover threshold routes and 9000 limits. | Helper/root redirect ownership awaits the Helper runtime. |
| `MoveContact` / `MoveHit` / `MoveGuarded` / `HitCount` | Partial | Reads move-level contact/hit/guard state and State-local hit count. Move* returns 1 through attacker hitpause and advances on unpaused ticks; later HitDef activation preserves the result until new contact. Live normal/guarded routes and the T-H-M-A 1011 target-confirm route are tested. | Helper/projectile parity, MoveReversed, and broader WinMUGEN lifetime cases remain incomplete. |
| `HitDefAttr` | Partial | Compares requested State/category sets with the normalized ActiveHitDef attr shared by HitBy/NotHitBy collision filtering. | Redirect and malformed multi-attr edge cases remain incomplete. |
| `GetHitVar` | Partial | Reads a contact snapshot for damage, hit/slide/control time, velocities, type/animation codes, fall values, ids, guarded, and yaccel across get-hit State changes. | Offset/fall-time keys and later guard/fall semantics still use diagnosed safe defaults. |
| `NumTarget` / `TargetID` / `TargetStateNo` | Partial | Reads a multi-entry attacker Target list, supports HitDef id filtering, and returns current two-player target State. `target(ID),MoveType` uses the same registry and SFalse on lookup failure. | Helper/team/multi-player selection and other redirected trigger families remain incomplete. |
| `PrevStateNo` | Partial | Stores the immediate source State on entry, including re-entry and multiple same-frame transitions; round reset starts without stale history. | Helper/custom-state ownership and broader real-character routes remain incomplete. |
| `enemy` / `enemynear` redirects | Partial | Root P1/P2, index 0, numeric/string/boolean/AIR child context, SFalse failure, grouping, diagnostics, and bundled 3405/3415 are tested. | Team/multiple-enemy nearest/index ordering and Helper ownership remain incomplete. |
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

Issue #58 Phase 4 changes execution structure, not expression compatibility status. Character load
compiles boolean operators, comparisons, numeric arithmetic/functions, and Redirect child expressions
into reusable evaluators. Focused tests compare the compiled path with the retained legacy evaluator,
including unsupported expressions and unused invalid `Cond` / `IfElse` branches. Existing per-Trigger
Matrix rows retain their prior status because no Trigger result is intentionally broadened.

For example, adding math support for `+`, `-`, `*`, `/`, `%`, `Sin`, `Cos`, or `IfElse` should update Expression rows, not arbitrary Trigger rows.

## Test expectations

Trigger tests should verify both positive and negative cases when possible.

A good trigger test includes:

- player state before evaluation;
- command set or opponent context if relevant;
- expected boolean result;
- at least one negative assertion for approximated triggers.

For animation-related triggers, tests should include both existing and missing animation/action cases.

## Three-character audit

The 2026-07-13 KFM/T-H-M-A/Yes030_e-rada audit checks every observed trigger classification against both Matrix mirrors. It exposed missing rows for `BackEdgeBodyDist`, `FrontEdgeBodyDist`, `StateTime`, and `TimeMod`; they are now tracked individually. A T-H-M-A `TimeMod = 7, 3` route produced a focused regression failure, so `TimeMod` and the observed `StateTime` alias were connected with positive/negative tests and remain Partial pending wider syntax/version verification. See `hitdef-real-character-regression.md` for the command and scope.
