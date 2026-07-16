# Trigger Evaluator

Updated: 2026-07-14

This document describes CNS trigger evaluation in WebMUGEN. For status per trigger, see `trigger-compatibility-notes.md` and the compatibility matrix.

## Responsibility

The trigger evaluator converts parsed trigger expressions into boolean runtime decisions.

It is responsible for:

- evaluating simple comparisons;
- evaluating trigger names such as `StateNo`, `Command`, `Time`, `Ctrl`;
- evaluating math and expression features tracked by the matrix;
- handling trigger grouping semantics;
- providing conservative fallbacks for not-yet-complete subsystems.

## Trigger grouping model

MUGEN controller triggers use this model:

```text
all triggerall expressions must be true
AND
at least one triggerN group must be true
```

Within a numbered group, all expressions in that group must be true.

Boolean trigger values also participate in numeric comparisons. In particular, `Ctrl = 1` and
`Ctrl = 0` expose the control flag as 1/0, matching real-character State -1 command routes; bare
`Ctrl` remains supported.

Example:

```text
triggerall = command = "holdfwd"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
trigger2 = stateno = 20
trigger2 = time > 2
```

This means:

```text
command holdfwd
AND not holddown
AND (
  (statetype S AND ctrl)
  OR
  (stateno 20 AND time > 2)
)
```

Do not flatten all trigger1/trigger2 expressions into one AND list.

## Expression support

Expression features are tracked separately from trigger names.

Examples:

- comparison operators: `=`, `!=`, `<`, `<=`, `>`, `>=`;
- range comparisons: `= [a,b]`, `!= [a,b]`;
- boolean operators: `&&`, `||`, `!`;
- math operators: `+`, `-`, `*`, `/`, `%`;
- math constants/functions: `Pi`, `E`, `Sin`, `Cos`, `Tan`, `IfElse`, `Cond`.

When adding expression support, update Expression rows in the matrix, not unrelated Trigger rows.

## Velocity coordinates

`PlayerState.vx` is stored in world coordinates, but the CNS `Vel X` trigger is facing-relative. The evaluator multiplies world X velocity by the player's facing when exposing `Vel X`; `Vel Y` remains unchanged.

## Character constants

`Const(...)` first resolves the current character CNS metadata. `[Velocity]` pairs expose their requested X/Y component, including `jump.neu`, `jump.fwd`, `jump.back`, `runjump.fwd`, and `runjump.back`; a directional entry that defines only X inherits the same character's `jump.neu` Y, as used by bundled real character data. `[Movement] yaccel` feeds both expressions and `Physics=A`. Existing defaults remain only for missing values already covered by the former compatibility table. Other WinMUGEN constant families and coordinate scaling remain Partial.

## Safe defaults

`Power` reads the currently evaluated player's durable gauge value, and `PowerMax` reads that player's `[Data] power`-derived limit. P1 and P2 are independent. Issue #58 Phase1 gives Helper evaluation an explicit root/parent/owner identity, but root/parent redirect syntax remains Partial.

Safe defaults are useful but should not be overclaimed.

Examples:

- `CanRecover` reads snapshotted `fall.recover` and `fall.recovertime` during an air-fall reaction. Common recovery states still require the CNS `Command = "recovery"` trigger; `CanRecover` alone must not auto-enter States 5200/5210;
- `NumHelper` counts committed Helpers owned by the current root and optionally filters by MUGEN Helper ID; same-frame pending spawns become visible only at the commit point;
- projectile contact time may return -1 before projectile contact is integrated.

These should generally remain Partial.

## GetHitVar snapshot

Successful HitDef contact stores numeric get-hit values on the defender so common get-hit states can read them after State changes. The current snapshot covers damage, selected hittime/slidetime/ctrltime, velocity values, type/animtype/airtype/groundtype codes, fall values including `fall.damage`/`fall.kill`, basic down velocity/hittime, hit/chain id, guarded, combo `hitcount`, snap `xoff`/`yoff`, and yaccel. It persists through the air fall/down path and is cleared after leaving get-hit states. Unsupported `zoff`/fall-time keys return the existing safe zero and are listed in contact diagnostics; therefore GetHitVar remains Partial.

For `GetHitVar(yvel)`, contact StateType S/C selects `ground.velocity.y` and A selects `air.velocity.y`; `fall.yvelocity` is exposed only as `GetHitVar(fall.yvel)`. Numeric trigger terms use MUGEN boolean truthiness, so `GetHitVar(fall)` and `!GetHitVar(fall)` correctly distinguish zero and nonzero values in common States 5000/5010.

## HitDefAttr

`HitDefAttr = SCA, NA, SA` compares the current ActiveHitDef's normalized attack State and attack categories. It uses the same normalization and matching rules as live `HitBy`/`NotHitBy`, preventing Trigger and collision filtering from disagreeing. Missing or malformed attr does not match.

## Real-character audit findings

The three-character HitDef audit observed `BackEdgeBodyDist`, `FrontEdgeBodyDist`, `ScreenPos`, `StateTime`, and `TimeMod`. Body-edge distance uses the existing fixed fallback stage bounds/player center and remains Partial. ScreenPos X/Y uses runtime player coordinates and remains Partial. `StateTime` now aliases current `Time`, and `TimeMod = divisor, remainder` evaluates State-time modulo for a positive divisor; both remain Partial pending broader WinMUGEN-version syntax audit. These names have separate Matrix rows so their presence in real CNS files is not hidden by a generic safe default.

## AnimElem timing

`AnimElem = N` is evaluated from the current AIR action, using 1-based element numbering. It is true only when element N starts, including when the animation reaches that element again after an explicit `LoopStart` or a default whole-action loop. `AnimElem = N, op T` compares the element-relative time with `=`, `!=`, `<`, `>`, `<=`, or `>=`; an invalid element number returns false. `AnimElemTime(N)` reads the same AIR-relative timeline.

Issue #54 identified the previous implementation error: bare `AnimElem` compared N with global `player.animTime`, so T-H-M-A State 101 emitted its `S100,1` footstep at the first global times only and never on later AIR loops. The production app now supplies AIR element timing to CNS evaluation, and focused real-character regression covers repeated elements 1 and 4.

## Move contact results

MoveContact, MoveHit, MoveGuarded, and HitCount read an attacker-side result owned by the current ActiveHitDef generation. A normal hit sets contact/hit and increments the State-local count; a live guardflag-approved contact sets contact/guarded without MoveHit or hit-count increment. New HitDef activation clears result flags while retaining the State hit count. On State entry, `movehitpersist` controls result preservation and `hitcountpersist` controls count preservation independently. `MoveHitReset` clears flags without erasing target hit history or count.

## Target lookup

Successful HitDef contact registers `{playerId, hitDefId, activeHitDefId}` on the attacker. NumTarget optionally filters by HitDef id; TargetID and TargetStateNo select the first matching entry. The storage permits multiple targets and is pruned for KO/destroyed players; round restart creates an empty list. Current TargetStateNo lookup is verified for the two-player runtime, while Helper/multi-player lookup remains Partial.

Issue #65 connects that same registry to redirect expressions. `target(ID), MoveType` treats `ID` as the HitDef `id`, selects the first matching live Target entry, resolves its runtime player, and then evaluates `MoveType` on that player. It does not compare `ID` with StateNo or runtime entity id. A missing id/player produces SFalse for both equality and inequality instead of falling back to self or the ordinary opponent.

Trigger record grouping remains `triggerall` AND every numbered group, repeated records with the same `triggerN` are AND, and different numbered groups are OR. `PrevStateNo` is written from the immediate source on every State entry, including multiple same-frame ChangeState entries; `MoveHit` remains owned by the accepted ActiveHitDef contact lifecycle described above. `raw.target_composite_trigger` records the three layers together for routes such as T-H-M-A 1015 -> 1016.

## Enemy redirects

Issue #66 routes `enemy`, `enemynear`, `enemy(0)`, and `enemynear(0)` through the same redirect parser/evaluator used by `target(ID)`. In the current two-root-player runtime, the other root player is both the sole enemy and nearest enemy; index zero selects it, while any other index is unresolved. Numeric, enum, and bare-boolean child expressions execute against the redirected player. Animation children receive that player's Anim, AnimTime, AnimElem, and AnimElemTime context rather than the caller's precomputed AIR values.

| Trigger form | Parser | Evaluator | Resolution | Failure | Self fallback |
|---|---|---|---|---|---|
| `enemy, expr` | Preserved | Numeric/string/boolean/AIR child | Other root player | SFalse | No |
| `enemynear, expr` | Preserved | Numeric/string/boolean/AIR child | Nearest enemy; sole other root in Phase 1 | SFalse | No |
| `enemy(n), expr` | Preserved with index | Same child evaluator | Index 0 in current two-player roster | SFalse for absent index | No |
| `enemynear(n), expr` | Preserved with index | Same child evaluator | Nearest index 0 in current two-player roster | SFalse for absent index | No |

Focused tests cover P1/P2 symmetry, MoveType, StateNo, Pos, Vel, Ctrl, Alive, Anim/AnimElem/AnimTime, GetHitVar, repeated-trigger AND, numbered-group OR, missing enemy, indexed lookup, and bundled T-H-M-A 3405/3415 execution. Team/multi-enemy ordering remains Partial.

## Debug output

For a route under investigation, expose:

- raw trigger expression;
- evaluated result for each expression;
- triggerall result;
- each triggerN group result;
- final `shouldRun` result;
- string-vs-record evaluation differences if parser bugs are suspected.

Good debug output is often more valuable than a quick fix.

## Testing guidance

Trigger tests should include:

- positive and negative cases;
- both command and non-command contexts when relevant;
- opponent context for distance and p2 triggers;
- animation lookup context for `AnimExist`, `SelfAnimExist`, `AnimElemNo`, `AnimElem`, and `AnimElemTime`;
- missing-data cases to confirm safe fallback behavior.

## Common mistakes

| Mistake | Consequence |
|---|---|
| Treating all triggerN lines as AND | Many valid routes never execute. |
| Re-parsing formatted trigger strings instead of parsed records | Parser/formatter discrepancies can break routes. |
| Marking safe defaults Complete | Matrix overstates compatibility. |
| Hiding trigger fixes in state-specific TypeScript | KFM may work but real characters break. |
