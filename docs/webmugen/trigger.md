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

- `CanRecover` may return a safe value before full get-hit recovery exists;
- `NumHelper` may return 0 before Helper lookup exists;
- projectile contact time may return -1 before projectile contact is integrated.

These should generally remain Partial.

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
