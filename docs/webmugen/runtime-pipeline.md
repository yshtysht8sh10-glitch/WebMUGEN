# Runtime Pipeline

Updated: 2026-07-06

This document describes the WebMUGEN frame pipeline. It is the first document to read when a character does not move, does not enter a state, or visually appears wrong even though the input is recognized.

The development policy remains binding:

- do not modify `public/chars/common1.cns`;
- express common WinMUGEN-like control in `public/chars/common.cmd` when practical;
- TypeScript is the execution engine, not the hidden rulebook;
- keep the compatibility matrix current.

## High-level frame flow

```text
Browser keyboard input
  ↓
BrowserInput
  ↓
keysToP1Input / keysToP2Input
  ↓
InputBuffer
  ↓
CommandResolver
  ↓
CNS State Runtime
  ↓
CNS Physics Step
  ↓
Stage rules
  ↓
Hit / recovery integration
  ↓
Round state / score / feedback
  ↓
CanvasRenderer
  ↓
Debug Overlay / Runtime History
```

## CNS State Runtime flow

Inside `stepCnsStateRuntime`, each player is stepped through the CNS runtime.

```text
current PlayerState
  ↓
State -3
  ↓
State -2
  ↓
State -1
  ↓
current StateDef
  ↓
finish trace
```

The negative states execute before the current state. This is important for common routing:

- `State -3`: global behavior;
- `State -2`: global behavior after -3;
- `State -1`: command/state routing;
- current state: behavior for the player's current `stateNo`.

If a negative state changes `stateNo`, the runtime returns early after recording the trace. This prevents the old current state from executing after a command route changes state.

When a player's HitDef hit-pause counter is positive, CNS StateDef headers and controllers are skipped for that player. The following physics step decrements only the counter; position, velocity, StateTime, and AnimTime remain frozen. Input buffers are updated before CNS execution and therefore continue collecting input during hit pause. Hit pause is per player and separate from SuperPause.

Match-level Pause/SuperPause is checked before State -3/-2/-1 and the current StateDef. Non-moving players therefore emit no repeated Explod or sound events while paused. The controller owner runs only while its `movetime` remains; physics, round time, hit resolution, and Explod lifecycle use the same frame's pause snapshot. Explods consume `pausemovetime` or `supermovetime` independently. When the clock reaches zero, one guarded CNS pass advances StateTime through physics without replaying time-zero controllers. Already-started Browser Audio continues; the runtime does not suspend AudioContext.

The App requestAnimationFrame loop synchronizes its monotonic frame counter into `GameState.frame` before CNS and subsystem stepping. Explod creation/lifecycle and `GameTime` therefore observe the real game tick; the frame must not remain at the initial zero or be incremented independently by each subsystem.

Each player carries `stateOwnerId` and `selfStateOwnerId`. CNS execution resolves the current document by owner id before scanning negative/current States. HitDef `p2getp1state = 1` and TargetState borrow the attacker/controller document; ChangeState remains in the current document; SelfState returns to the self owner document. An explicit owner lookup failure uses an empty document and a diagnostic, never another player's or common CNS as a silent fallback.

## Controller execution flow

For each controller in a StateDef:

```text
controller candidate
  ↓
shouldRun(controller)
  ↓
triggerall AND + triggerN OR evaluation
  ↓
if false: skip controller
  ↓
if true: executeController
  ↓
mutate PlayerState
  ↓
record executed controller and debug trace
```

A controller can be present and still not execute. The Debug Overlay should make the difference clear.

## State entry flow

State entry should happen through centralized logic such as `enterState`.

State entry applies:

- new `stateNo`;
- `stateTime = 0`;
- initial animation when present;
- StateDef header fields such as `type`, `movetype`, `physics`, `ctrl`, `poweradd`, `juggle`, `facep2`.

Entry-only fields must not be re-applied every frame while the state remains active.

## Common movement route example: crouch

```text
ArrowDown
  ↓
BrowserInput sees key
  ↓
P1 input down=true
  ↓
CommandResolver resolves holddown
  ↓
State -1 finds Common Crouch Start
  ↓
triggerall command = "holddown" passes
  ↓
trigger1 statetype = S and ctrl pass
  ↓
ChangeState value=10 executes
  ↓
enterState(10)
  ↓
StateDef 10 header applies type=C physics=C anim=10
  ↓
Debug shows state=10
```

If the screen does not crouch, check whether the runtime reached State 10 or whether rendering/animation failed after State 10.

## Common movement route example: walk forward

```text
ArrowRight
  ↓
BrowserInput sees key
  ↓
P1 input right=true
  ↓
CommandResolver resolves fwd and holdfwd
  ↓
State -1 finds Common Walk Forward
  ↓
ChangeState value=20 executes when not already in State 20
  ↓
State 20 becomes active
  ↓
walk velocity / animation glue must run
  ↓
Debug shows state=20, vel x != 0, anim=20
```

A state transition alone is not enough for visible walking. If the overlay says `state=20` but `vel=(0,0)` and `anim=0`, the route entered the state but movement/animation logic did not run.

## Debugging checklist

When something fails, inspect the pipeline in this order:

1. key input is visible;
2. normalized player input is correct;
3. command name is resolved;
4. State -1 contains the expected route;
5. triggerall passes;
6. the correct triggerN group passes;
7. `shouldRun` is true;
8. controller executes;
9. `stateNo` changes if expected;
10. StateDef header applies;
11. velocity / animation / physics are correct;
12. renderer shows the corresponding visual result.

Do not skip directly to TypeScript changes before identifying the failing layer.

## What belongs where

| Layer | Responsibility |
|---|---|
| `BrowserInput` | Browser key state. |
| `InputBuffer` | Recent input history. |
| `CommandResolver` | CMD command matching and buffering. |
| `common.cmd` | Visible common routing and temporary movement glue where practical. |
| `CnsStateRuntime` | Trigger evaluation and controller execution. |
| `CnsRuntimeTrigger` | CNS expression and trigger evaluation. |
| `CnsPhysicsStep` | Velocity, gravity, position, ground handling. |
| `CanvasRenderer` | Drawing the state produced by runtime and physics. |
| Debug Overlay | Observability for each layer. |

## UI lifetime

The requestAnimationFrame loop, `CanvasRenderer`, `gameStateRef`, input buffers, round state, and the canvas DOM node are part of the live runtime. Debug top-level tabs must not unmount the game/canvas panel when switching to static source views. Keep the game/runtime panel mounted and switch its visibility with CSS/ARIA so the renderer continues to draw to the same canvas element and runtime state is not reinitialized. Heavy static/files contents may unmount while inactive and remount on demand.

## Common failure patterns

| Symptom | Likely failing layer |
|---|---|
| Key shown but command missing | CommandResolver / CMD syntax. |
| Command shown but no route | Loader merge or State -1 route missing. |
| Route shown but `run=0` | Trigger evaluation. |
| `run=1` but state unchanged | Controller execution / parameter parsing. |
| State changed but type/anim wrong | State entry / StateDef header. |
| State changed but no motion | Physics or movement controller. |
| State and motion correct but screen wrong | Animation or rendering. |
