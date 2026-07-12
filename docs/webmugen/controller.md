# State Controller Executor

Updated: 2026-07-09

This document describes how State Controllers are executed. For per-controller status, see `state-controller-compatibility-notes.md` and the compatibility matrix.

## Responsibility

The controller executor applies a State Controller after its triggers have passed.

It should:

- read parsed controller type and parameters;
- mutate `PlayerState` only according to the controller semantics;
- report whether it executed;
- preserve compatibility data needed by later subsystems;
- remain generic, not KFM-specific.

## Execution flow

```text
controller candidate
  ↓
trigger records evaluated
  ↓
if false: skip
  ↓
if true: execute controller type
  ↓
return next PlayerState + executed flag + controller name
```

The runtime trace should distinguish:

- controller was present;
- controller trigger passed;
- controller executed;
- controller changed state/velocity/animation/etc.

## Controller categories

### Basic state mutation

Examples:

- `ChangeState`
- `SelfState`
- `CtrlSet`
- `StateTypeSet`
- `MoveTypeSet`

These mutate state identity or state flags.

`ChangeState` should use centralized state entry. `SelfState` remains Partial until custom-state ownership semantics are implemented.

### Motion and position

Examples:

- `VelSet`
- `VelAdd`
- `VelMul`
- `PosSet`
- `PosAdd`

`PlayerState.vx` is stored in world coordinates and position integration adds it directly to world X. `VelSet` and `VelAdd` therefore multiply CNS X values by the player's current facing once when the controller executes. `VelMul` scales the already converted world velocity and must not apply facing again. If parameters are expressions, parser/evaluator support must be verified before marking broad compatibility.

### Animation

Examples:

- `ChangeAnim`
- `ChangeAnim2`

`ChangeAnim` is runtime animation selection. Its `value` parameter is evaluated through the CNS numeric expression evaluator, so expressions such as `ifelse((vel x)=0,44,45)+var(5)*4` can use the current player velocity and variables. `ChangeAnim2` depends on target/common animation ownership and remains Partial if only recognized.

### Hit and attack state

Examples:

- `HitDef`
- `HitBy`
- `NotHitBy`
- `HitVelSet`
- `HitFallVel`
- `HitFallDamage`
- `MoveHitReset`

These are high-risk compatibility areas. Parser support or field storage does not mean complete WinMUGEN behavior.

Keep matrix status Partial until contact lifecycle, target creation, guard, hit pause, get-hit states, and persistence are verified.

### Target / Helper / Projectile / Explod

Examples:

- `TargetState`
- `TargetVelSet`
- `Helper`
- `Projectile`
- `Explod`

Recognizing these as no-ops is useful to keep characters from crashing, but it is not full behavior.

These remain Partial or Unsupported depending on whether the runtime has a meaningful shim.

### Visual/audio effects

Examples:

- `AfterImage`
- `PalFX`
- `EnvShake`
- `PlaySnd`
- `Trans`
- `AngleDraw`

If the controller only stores a field or is skipped safely, mark Partial.

## Complete vs Partial

`Null` can be Complete because explicit no-op is the intended behavior.

`AfterImage` as safe no-op is Partial because the visual effect is missing.

`HitDef` is Partial. The live CNS runtime creates a limited `ActiveHitDef`, applies damage, selects ground/air hit time at contact, and maps explicit ground `animtype` Light/Medium/Hard to the initial required Anim 5000/5001/5002. The animation is selected once at successful contact; a missing required animation is diagnosed without substituting another animation. Omitted or currently unsupported `animtype` values preserve the previous Anim 5000 behavior. Air, crouch, guard, fall, Back/Up/DiagUp, pause, velocity, flags, targets, and broader combat semantics remain incomplete.

During the selected hit time, the runtime keeps `ctrl = false`, blocks control-enabling `CtrlSet`, blocks early recovery to State 0/52, and ignores State -1 input ChangeState routes. Internal common get-hit transitions such as State 5000 to 5001 remain available. Hit-stun elapsed time is stored independently from `stateTime` so internal get-hit State changes do not shorten the configured duration.

## Debugging controller issues

When a controller appears not to work:

1. confirm the StateDef contains the controller;
2. confirm triggers pass;
3. confirm executor reaches the controller type branch;
4. confirm parameters parse correctly;
5. confirm before/after PlayerState changed as expected;
6. confirm physics/animation/rendering did not overwrite the effect.

## Test guidance

Controller tests should include:

- trigger false case;
- trigger true case;
- expected state mutation;
- parameter parse edge cases;
- matrix status update only for the exact behavior tested.

Do not use broad tests to mark unrelated controller features Complete.
