# Trigger Evaluator

Updated: 2026-07-06

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

## Safe defaults

Safe defaults are useful but should not be overclaimed.

Examples:

- `CanRecover` reads snapshotted `fall.recover` and `fall.recovertime` during an air-fall reaction. Common recovery states still require the CNS `Command = "recovery"` trigger; `CanRecover` alone must not auto-enter States 5200/5210;
- `NumHelper` may return 0 before Helper lookup exists;
- projectile contact time may return -1 before projectile contact is integrated.

These should generally remain Partial.

## GetHitVar snapshot

Successful HitDef contact stores numeric get-hit values on the defender so common get-hit states can read them after State changes. The current snapshot covers damage, selected hittime/slidetime/ctrltime, velocity values, type/animtype/airtype/groundtype codes, fall values including `fall.damage`/`fall.kill`, basic down velocity/hittime, hit/chain id, guarded, combo `hitcount`, snap `xoff`/`yoff`, and yaccel. It persists through the air fall/down path and is cleared after leaving get-hit states. Unsupported `zoff`/fall-time keys return the existing safe zero and are listed in contact diagnostics; therefore GetHitVar remains Partial.

For `GetHitVar(yvel)`, contact StateType S/C selects `ground.velocity.y` and A selects `air.velocity.y`; `fall.yvelocity` is exposed only as `GetHitVar(fall.yvel)`. Numeric trigger terms use MUGEN boolean truthiness, so `GetHitVar(fall)` and `!GetHitVar(fall)` correctly distinguish zero and nonzero values in common States 5000/5010.

## HitDefAttr

`HitDefAttr = SCA, NA, SA` compares the current ActiveHitDef's normalized attack State and attack categories. It uses the same normalization and matching rules as live `HitBy`/`NotHitBy`, preventing Trigger and collision filtering from disagreeing. Missing or malformed attr does not match.

## Real-character audit findings

The three-character HitDef audit observed `BackEdgeBodyDist`, `FrontEdgeBodyDist`, `ScreenPos`, `StateTime`, and `TimeMod`. Body-edge distance uses the existing fixed fallback stage bounds/player center and remains Partial. ScreenPos X/Y uses runtime player coordinates and remains Partial. `StateTime` now aliases current `Time`, and `TimeMod = divisor, remainder` evaluates State-time modulo for a positive divisor; both remain Partial pending broader WinMUGEN-version syntax audit. These names have separate Matrix rows so their presence in real CNS files is not hidden by a generic safe default.

## Move contact results

MoveContact, MoveHit, MoveGuarded, and HitCount read an attacker-side result owned by the current ActiveHitDef generation. A normal hit sets contact/hit and increments the State-local count; a live guardflag-approved contact sets contact/guarded without MoveHit or hit-count increment. New HitDef activation clears result flags while retaining the State hit count. On State entry, `movehitpersist` controls result preservation and `hitcountpersist` controls count preservation independently. `MoveHitReset` clears flags without erasing target hit history or count.

## Target lookup

Successful HitDef contact registers `{playerId, hitDefId, activeHitDefId}` on the attacker. NumTarget optionally filters by HitDef id; TargetID and TargetStateNo select the first matching entry. The storage permits multiple targets and is pruned for KO/destroyed players; round restart creates an empty list. Current TargetStateNo lookup is verified for the two-player runtime, while Helper/multi-player lookup remains Partial.

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
- animation lookup context for `AnimExist`, `SelfAnimExist`, `AnimElemNo`;
- missing-data cases to confirm safe fallback behavior.

## Common mistakes

| Mistake | Consequence |
|---|---|
| Treating all triggerN lines as AND | Many valid routes never execute. |
| Re-parsing formatted trigger strings instead of parsed records | Parser/formatter discrepancies can break routes. |
| Marking safe defaults Complete | Matrix overstates compatibility. |
| Hiding trigger fixes in state-specific TypeScript | KFM may work but real characters break. |
