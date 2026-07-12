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

`HitDef` is Partial. When the controller activates, the live CNS runtime evaluates and freezes a typed `ActiveHitDef` snapshot containing attr, damage, ground/air/fall animation types, hit/guard flags, priority, hit/guard pause, ground/air/guard types, hit times, velocities, major fall fields, and id/chain fields. Numeric CNS expressions and parameter pairs are evaluated with the activation-frame player/opponent context. After that hit is consumed, re-execution of the same controller does not replace the snapshot. Stored fields whose combat behavior is not connected are reported as `stored_not_applied`; failed evaluations retain their parameter names in diagnostics.

The currently connected subset requires an ActiveHitDef and AIR Clsn overlap, then applies damage, selects ground/air hit time and velocity from the defender StateType at contact, and maps explicit ground `animtype` Light/Medium/Hard to required Anim 5000/5001/5002. Hit velocity X is multiplied once by attacker facing; Y is applied directly. Hit pause preserves the applied velocity, and physics moves the defender after pause ends. Missing ActiveHitDef or Clsn boxes reject the hit. `guard.velocity` is stored but awaits the guard path. Air state/fall reactions, Back/Up/DiagUp behavior, pause values, flags, priority, chain rules, targets, and broader combat semantics remain incomplete.

Successful contacts are recorded by ActiveHitDef generation and defender id. Continued overlap with the same pair cannot apply damage, HitEvent, or hit stun again. A new ActiveHitDef generation can hit the defender again; state entry and `MoveHitReset` clear the relevant history. The current behavior is one hit per generation/defender regardless of the `hitonce` parameter, whose distinct 0/1 semantics remain Partial.

Attacker move-result state separately tracks contact, hit, guarded, and State-local hit count for MoveContact/MoveHit/MoveGuarded/HitCount. New HitDef generations reset result flags but retain count; State changes clear all. `MoveHitReset` clears only result flags, preserving both duplicate-hit target history and count.

Successful non-KO contact also registers a Target entry with player id, HitDef id, and ActiveHitDef generation. Entries persist independently of State transitions, support multiple targets, and are removed for KO/destroyed players or round restart. Target controllers consume this foundation in the next compatibility phase.

HitDef `pausetime` is applied as separate attacker/defender counters. Positive counters skip CNS controller execution and freeze physics/timers while input buffering continues; zero resumes without an extra frame. This hit pause is independent of the Partial SuperPause controller. `guard.pausetime` awaits guard contact.

During the selected hit time, the runtime keeps `ctrl = false`, blocks control-enabling `CtrlSet`, blocks early recovery to State 0/52, and ignores State -1 input ChangeState routes. Internal common get-hit transitions such as State 5000 to 5001 remain available. Hit-stun elapsed time is stored independently from `stateTime` so internal get-hit State changes do not shorten the configured duration.

StateDef headers and allowed internal ChangeState controllers are also forced back to `ctrl = false` immediately when hit stun is active, preventing a one-controller-frame control leak. Diagnostics distinguish blocked controllers from this post-transition/header force. Full common1 `GetHitVar`-driven branching is tracked separately under GetHitVar compatibility.

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
