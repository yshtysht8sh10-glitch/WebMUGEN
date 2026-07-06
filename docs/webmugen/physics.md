# Physics Runtime

Updated: 2026-07-06

This document describes the physics layer after CNS runtime has executed controllers for a frame.

## Responsibility

Physics is responsible for applying movement integration after CNS controllers have mutated player state.

Typical inputs:

- `stateType`;
- `physics`;
- position;
- velocity;
- ground level;
- state-specific flags;
- controller results such as `VelSet`, `VelAdd`, `VelMul`, `PosSet`, `PosAdd`.

Typical outputs:

- updated position;
- updated velocity;
- ground contact / landing decisions;
- debug physics line.

## Pipeline position

```text
CNS State Runtime
  ↓
CNS Physics Step
  ↓
Stage rules
  ↓
Hit / recovery integration
  ↓
Rendering
```

If CNS correctly enters a state but motion is wrong, inspect physics next.

## StateDef `physics` header

The `physics` header is parsed and applied, but full behavior is still Partial.

Common values:

- `S`: standing physics;
- `C`: crouching physics;
- `A`: air physics;
- `N`: no built-in physics.

Current compatibility should remain conservative until each behavior is tested against expected WinMUGEN flow.

## Controller interaction

Physics should not erase controller mutations incorrectly.

Important interactions:

- `VelSet` sets velocity before physics integrates position;
- `VelAdd` and `VelMul` modify velocity before integration;
- `PosSet` and `PosAdd` modify position directly;
- air physics may apply gravity;
- ground checks may trigger landing state routes.

## Movement debugging

For movement bugs, inspect both state and physics lines.

Example failure:

```text
state=20
vel=(0,0)
anim=0
```

This means the player entered walk state but did not receive walking velocity or animation. The fix may belong in `common.cmd`, controller execution, or physics depending on the route.

## Landing behavior

Landing should be observable as:

```text
physics=A
vel y >= 0
pos y >= ground
ChangeState 52
```

The current ground value is visible in common routing notes where used. Hard-coded temporary values should be documented and eventually replaced with stage/coordinate-aware logic.

## Debug Overlay fields

A physics line should generally expose:

- state number;
- state type;
- physics type;
- ctrl;
- facing;
- power / juggle when useful;
- position;
- velocity;
- state time;
- animation/time.

This lets a screenshot distinguish state routing bugs from physics/rendering bugs.

## Test expectations

Physics tests should verify:

- position changes after non-zero velocity;
- velocity set/add/mul effects;
- ground/landing behavior;
- no unexpected motion for idle states;
- walk/jump/crouch integration paths.

When a physics test fails, print before/after state, position, velocity, state type, physics, and animation.

## Known caution

Do not mark `physics` Complete only because the header is parsed. The matrix row remains Partial while real behavior is incomplete.
