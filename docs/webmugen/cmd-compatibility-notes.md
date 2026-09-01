# CMD Compatibility Notes

Updated: 2026-09-01

This document summarizes CMD implementation notes. The compatibility matrix remains the source of truth:

- `docs/webmugen/winmugen-compatibility-matrix.html`
- `docs/webmugen/winmugen-compatibility-matrix.md`

Follow `docs/webmugen/development-policy.md`: common movement routing belongs in `public/chars/common.cmd` when it can be expressed as MUGEN data.

## Current CMD support summary

| Feature | Matrix status | Current note | Remaining risk |
|---|---|---|---|
| Single button commands | Complete | Browser Input Config exposes keyboard/gamepad mappings for `a,b,c,x,y,z` and Start; Start is emitted as the WinMUGEN `s` token and production T-H-M-A coverage resolves `name = "start"` into Taunt State 195. When a CMD also defines the corresponding direct button hold (for example `b` and `/b`), the hold is exposed first and the press on the following input tick, preserving WinMUGEN button-hold priority without losing the normal press. | Motion-final button priority and broader buffering still need audit. |
| Single direction `U/D/F/B` | Complete | A non-held direction command is emitted only on a fresh direction edge. Holding the same direction continues to satisfy `/U`, `/D`, `/F`, or `/B`, but does not repeat the corresponding non-held command every tick. Mother_Legion State 50 verifies that `command = "up"` applies its authored `VelAdd y = -2` once instead of continuously accelerating. | Compound direction and charge timing still need audit. |
| Hold direction `/D` | Complete | Used for crouch route. | Complex combined syntax needs audit. |
| Hold direction `/F` | Complete | Used for walk-forward route. | Direction depends on facing/context assumptions. |
| Hold direction `/B` | Complete | Used for walk-back route. | Direction depends on facing/context assumptions. |
| Hold direction `/U` | Complete | Used for ground jump routing; a release/re-press also feeds root-player special State 45 AirJump handling. | Exact Pause/SuperPause timing remains under audit. |
| Direction sequences | Partial | Facing-relative sequences are verified through T-H-M-A and focused tests. A held diagonal may satisfy a neighboring cardinal step for normal leniency, but one unchanged diagonal stretch cannot be reused as alternating `D, F, D, F` inputs. | Other sequence forms and charge syntax need audit. |
| Button sequences | Partial | Basic support; simple button commands are kept briefly active. | Full sequence timing and cancel windows need audit. |
| Simultaneous buttons | Partial | `+` requires all listed buttons to be active together and accepts the chord when the final required button is added; the buttons no longer need to acquire their pressed edge on the same tick. Direct button holds are resolved before their matching press commands, so bundled itoko State 1301's four held-button AND route reaches release State 1335 instead of being preempted by its earlier `b` attack route. Bundled itoko's final `z+c` definition is also preserved when `[Statedef -1]` follows it. | Negative-edge chords, motion-final press priority, and broader WinMUGEN timing still need audit. |
| Release commands | Partial | The matcher retains `~` and requires the matched direction/button to be released in a newer input frame. | Numeric charge forms such as `~30$D` and other compound modifiers remain unsupported. |
| Buffer time | Partial | InputBuffer exists; parsed commands inherit CMD `[Defaults]` values. Without a Defaults section, button-ending motion commands receive a one-tick compatibility buffer, keeping itoko's `~B,B,b` and `~D,D,b` active after completion; established short buffers for simple buttons/double taps remain intact. Direction-only holds remain unlatched. | Exact WinMUGEN timing and long hit-pause windows still need audit. |
| `command.time` | Partial | The parser applies `[Defaults] command.time` to commands that omit `time`, including when `[Defaults]` follows the command blocks; otherwise the matcher uses 15. A 25-frame window accepts sequences spanning 24 or 25 frames and rejects 26 frames. | Broader WinMUGEN timing and pause behavior still need audit. |
| `command.buffer.time` | Partial | The parser applies `[Defaults] command.buffer.time` to omitted values; without Defaults the matcher supplies its compatibility defaults, including one tick for button-ending motions. Direction-only holds are excluded from post-match buffering. | Exact WinMUGEN pause behavior still needs audit. |
| `$` direction match | Partial | KFM hold commands work. | Full syntax and facing-relative behavior need tests. |
| `/` hold prefix | Partial | Used in common commands. | Syntax coverage is incomplete. |

Issue #79 was caused in the production matcher, not by State -1 route ordering. During a single `D -> DF -> F+a` motion, several held `DF` frames could each satisfy both cardinal `D` and `F`. That made T-H-M-A's `~D, F, D, F, a` super command active alongside its normal `~D, DF, F, a` command. The matcher now rejects adjacent, different cardinal steps when both are satisfied only by reusing the same unchanged diagonal direction. Exact `DF` steps, `$`/`/` hold commands, release commands, and lenient final-direction-plus-button input remain covered by focused tests.

State -1 command controllers are evaluated normally outside HitPause, including while a player is in a hit or guard reaction. The controller's own triggers decide whether it may interrupt that State. This is required for WinMUGEN guard cancels: Elecbyte's 3 Sep 1999 update notes give `command` together with `StateNo >= 150` / `StateNo <= 153` as the authored pattern. WebMUGEN does not hard-code those State numbers or `GetHitVar(guarded)` as an engine exception. An akkarin-derived route verifies held forward plus the `x+y` command enters State 720 from State 150 and consumes 1000 Power after HitPause; the same route remains false in State 5000 or below 1000 Power. HitPause still requires `ignorehitpause = 1`.

## Common routing policy

`public/chars/common.cmd` is intentionally part of the WebMUGEN compatibility layer.

It should contain visible baseline routes for common behavior such as:

- stand to crouch;
- crouch hold/release, scoped to common State 10/11 so character-owned crouching states are not intercepted;
- jump start and jump velocity glue;
- walk forward/back routes;
- temporary VelSet/ChangeAnim glue required while full common1/runtime semantics are incomplete.

Do not move these rules into hidden TypeScript logic unless they are truly engine semantics.

The walk-forward and walk-back routes intentionally skip dash/run states `100`
through `107`. This keeps a held direction from converting a character dash
substate such as `101` into State `20` through the common `Statedef -1` route.
Their temporary `VelSet` and `ChangeAnim` glue also excludes `holdup`. Therefore,
a diagonal jump entered from State `20` or `21` cannot reapply the previous walk
animation after the jump route has entered State `40`.

The baseline route and the temporary State-number-gated glue have different ownership rules.
The `holdfwd`/`holdback` `ChangeState` route may enter a State supplied by the Character or its
DEF-selected `stcommon`, but WebMUGEN does not then inject the common `VelSet`/`ChangeAnim` glue
into that character-owned State. This is required by WinMUGEN characters that dynamically choose
walk animations. akkarin State 20 selects Anim 20 or 20020 from `var(3)`; forcing Anim 20 in
State -1 and restoring Anim 20020 in the current State reset the displayed animation every tick.
Common-owned State 20/21 continues to receive the temporary glue.

## Debugging CMD routes

For command routes, inspect the pipeline in this order:

1. browser key input;
2. normalized player input;
3. resolved command names;
4. `State -1` candidate route;
5. triggerall and trigger group result;
6. `ChangeState` execution;
7. state header application;
8. velocity/animation/physics after runtime.

A route is not visually working if it only enters the state but velocity and animation stay idle. The Debug Overlay should show both state transition and the movement/animation side effects.

## Test expectations

CMD tests should cover:

- raw input to command names;
- command timing and buffer windows;
- positive and negative cases;
- route integration through CNS runtime for important movement commands.

For movement routes, tests should assert `stateNo`, `velocity`, and `animNo` where applicable.

Issue #50 verifies the production path from Shift-JIS CMD parsing through input normalization,
history, matching, the active command set, Japanese `Command` trigger comparison, and State -1
`ChangeState`. The matcher records the frame used by each command step; a `~` step succeeds only
when a newer frame no longer contains that direction or button. Facing conversion remains confined
to `InputBuffer`, so B/F is not converted a second time during matching.

The live runtime also retains a resolved command containing a non-hold button while its player is in
attacker hit pause. CNS execution remains frozen during the pause, then the retained command is added
to the first active frame and cleared. Direction-only commands such as `holddown` continue to reflect
the current key state instead of becoming sticky. A bundled T-H-M-A regression verifies the original
State 200 `MoveContact` route from `x` into the close `a` State 232 cancel after eight hit-pause ticks.
