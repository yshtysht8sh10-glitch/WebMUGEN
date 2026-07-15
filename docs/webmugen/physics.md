# Physics Runtime

Updated: 2026-07-11

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

For ordinary `Physics=A`, the physics step reads `Const(movement.yaccel)` from the current character CNS and adds it exactly once before integrating Y. The previous unconditional `0.6` gravity is retained only as the existing missing-value fallback. `Physics=N` receives no automatic gravity, so common air-hit/fall states continue to use their explicit `VelAdd y = GetHitVar(yaccel)` controllers without a second acceleration.

Jump State 40 comes from the character's DEF-selected `stcommon` or external `public/chars/common1.cns`; `public/chars/common.cmd` supplies only the visible `holdup -> State 40` route and does not replace the State body. `Const(velocity.jump.y)` resolves the character `jump.neu` Y, and directional X plus the standard forward run-jump override follow the selected common State. VelSet converts X by Facing once and leaves MUGEN Y unchanged. State 50 then uses character air acceleration until the tested State 52 ground transition.

On HitDef contact, the defender receives `ground.velocity` or `air.velocity` according to its StateType at contact. CNS X is converted once into the defender reaction direction: the common negative value sends the target away from the attacker for either Facing. Y remains in CNS/internal velocity coordinates. Physics does not clear velocity during hit pause and begins integrating it when pause ends. Guard contact separately applies Facing-relative `guard.velocity`.

Explod velocity uses the same one-time world-X conversion at controller evaluation. On a non-bound lifecycle tick, position consumes the current velocity and velocity then consumes acceleration. Creation/bound ticks hold this motion; after default `bindtime=1` releases, KFM wood begins its configured velocity/acceleration path. Pause/SuperPause gating is handled separately in Issue #35.

StateDef `velset` is applied before the entered State's controllers. Common ground-hit shake State 5000 therefore clears live velocity with `velset = 0,0` while retaining the contact `hitVelY`/`GetHitVar(yvel)` snapshot. Physics must integrate the live `vy`, not the saved hit velocity. The follow-up Issue #42 regression first diverged later in CNS Controller execution: a successful 5001 ChangeState was followed by the State 5000 fallback ChangeState to 5030. Successful ordinary-State ChangeState/SelfState now terminates the remaining controller list, so the correct ground route reaches physics without being overwritten.

Issue #59 completes the 5000-family entry selection. HitDef recognizes Light, Medium, Hard, Back, Up, and DiagUp as real animtypes. Contact selects the same High/Low base and optional Up/DiagUp AIR existence fallback as the unmodified common States before hitpause, while the persistent numeric snapshot drives the same ChangeAnim branches after hitpause. Missing `animtype` uses the WinMUGEN Light default rather than a compatibility fallback.

Air get-hit states with `MoveType = H` are not clamped before CNS sees their ground crossing. This preserves the `Pos Y`/`Vel Y` conditions used by common States 5030/5035/5040/5050 to choose recovery, fall, bounce, and down routes. `HitVelSet` restores the contact velocity after State 5020, while `HitFallVel` restores fall velocity during bounce. Non-hit air movement keeps the normal landing clamp behavior.

Issue #60 audits the complete 5030 fall family against the unmodified common States. State 5030 restores contact velocity, 5035 handles the optional transition animation, 5040 handles non-fall recovery, and 5050 owns falling, recovery input, and contact with the ground. The number 5060 is an animation family selected by State 5050, not a `StateDef`. Trip State 5070 remains frozen through hitpause and enters 5071 only when `HitShakeOver`; 5071 then restores hit velocity and applies `GetHitVar(yaccel)`.

`raw.gethitvar_frame` includes position/velocity, yaccel, ground crossing, fall/recover window, recovery input, and the ground-clamp decision for these States. `raw.gethit_changestate_eval` reports each ChangeState controller index and result. `raw.fall_pause` records hitpause or global pause frames with frozen state/animation clocks.

Issue #61 separates lying-hit time from get-up time. A HitDef contacting `StateType = L` enters State 5080 and uses `down.velocity` plus `down.hittime`; nonzero Y launches through the 5090 animation and 5030, while zero Y slides through 5081. `down.bounce` decides whether a launched lying target receives one fall bounce. Omitted `down.velocity` inherits `air.velocity`.

State 5110 get-up scheduling uses an independent counter loaded from the defender's `[Data] liedown.time`. It freezes during hitpause/Pause, does not depend on StateTime or `down.hittime`, and never schedules 5120 at zero Life. `raw.down_clock` exposes elapsed/duration/remaining and the advance/frozen/getup/ko_hold result.

HitDef `pausetime = p1, p2` initializes separate attacker and defender counters. While a counter is positive, CNS controllers, position, velocity integration, StateTime, and AnimTime are frozen; the physics step decrements the counter once per game frame. A counter of zero resumes normally without an extra frozen frame. Input buffering remains active outside this per-player freeze. Match-level Pause/SuperPause is separate: it freezes non-moving players and round/hit stepping, permits only the controller owner for `movetime`, and uses a resume guard before normal CNS execution restarts.

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

Focused trajectory tests record apex, airtime, and landing frame for two distinct character profiles. The current ground value is still the runtime stage baseline; broader stage/coordinate scaling remains Partial.

## Player push

Issue #57 removes the fixed 44x80 normal path. The runtime carries `[Size]` `ground.front/back`, `air.front/back`, `height`, `xscale`, and `yscale` into `PlayerState` as raw character constants. The push solver selects the ground or air pair from the current state, applies scale once, and maps front/back through the current Facing. When no CNS constants have reached a synthetic or legacy state, the documented WinMUGEN default Size values are used instead of the old generic rectangle.

Horizontal separation is applied only when both Size rectangles overlap vertically and horizontally. `PlayerPush = 0` disables separation for the frame in which the controller executes; it returns to enabled on the next CNS frame unless another `PlayerPush = 0` executes. Grounded players automatically face the opponent. Airborne players preserve Facing through a cross-over; Facing changes on the landing path or through explicit `Turn`/`facep2` behavior.

This remains Partial compatibility because dynamic `Width` controller overrides, camera-relative stage bounds, and broader multi-entity push behavior still need integration. `raw.push` records both resolved boxes, their Size source, overlap and skip/apply result; `raw.cross` records airborne status and Facing changes. Canvas debug draws the same resolved push rectangle in blue.

## HitDef cornerpush and snap

Accepted HitDef contact selects `ground.cornerpush.veloff`, `air.cornerpush.veloff`, `down.cornerpush.veloff`, `guard.cornerpush.veloff`, or `airguard.cornerpush.veloff` from the defender contact class. It changes attacker world X velocity only when the defender is at the existing fallback stage boundary (48 or 912), with the CNS value converted once by attacker Facing. A middle-stage contact leaves velocity unchanged. Camera-relative screen edges and dynamic stage bounds remain Partial.

HitDef `snap` places the defender at attacker position plus the requested offset; X is Facing-relative and Y uses the runtime stage coordinate directly. Existing stage rules clamp/push later in the frame, so snap does not bypass stage safety.

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
