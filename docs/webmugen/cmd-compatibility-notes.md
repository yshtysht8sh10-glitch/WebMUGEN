# CMD Compatibility Notes

Updated: 2026-07-14

This document summarizes CMD implementation notes. The compatibility matrix remains the source of truth:

- `docs/webmugen/winmugen-compatibility-matrix.html`
- `docs/webmugen/winmugen-compatibility-matrix.md`

Follow `docs/webmugen/development-policy.md`: common movement routing belongs in `public/chars/common.cmd` when it can be expressed as MUGEN data.

## Current CMD support summary

| Feature | Matrix status | Current note | Remaining risk |
|---|---|---|---|
| Single button commands | Complete | Basic support. | Full command priority and buffering still need broader tests. |
| Hold direction `/D` | Complete | Used for crouch route. | Complex combined syntax needs audit. |
| Hold direction `/F` | Complete | Used for walk-forward route. | Direction depends on facing/context assumptions. |
| Hold direction `/B` | Complete | Used for walk-back route. | Direction depends on facing/context assumptions. |
| Hold direction `/U` | Complete | Used for jump route. | Air-jump/common-state behavior incomplete. |
| Direction sequences | Partial | Facing-relative sequences are verified through T-H-M-A and focused tests. A held diagonal may satisfy a neighboring cardinal step for normal leniency, but one unchanged diagonal stretch cannot be reused as alternating `D, F, D, F` inputs. | Other sequence forms and charge syntax need audit. |
| Button sequences | Partial | Basic support; simple button commands are kept briefly active. | Full sequence timing and cancel windows need audit. |
| Simultaneous buttons | Partial | Basic syntax exists. | Full parsing/timing behavior needs audit. |
| Release commands | Partial | The matcher retains `~` and requires the matched direction/button to be released in a newer input frame. | Numeric charge forms such as `~30$D` and other compound modifiers remain unsupported. |
| Buffer time | Partial | InputBuffer exists and default buffering covers simple buttons/double-tap directions. Double-tap directions do not retrigger while the second direction is held. | Exact WinMUGEN timing still needs audit. |
| `command.time` | Partial | A 25-frame window accepts sequences spanning 24 or 25 frames and rejects 26 frames. | Broader WinMUGEN timing and pause behavior still need audit. |
| `command.buffer.time` | Partial | Parser and matcher honor explicit post-match active window; double-tap direction buffering applies after release, not during a held second tap. | Exact WinMUGEN behavior still needs audit. |
| `$` direction match | Partial | KFM hold commands work. | Full syntax and facing-relative behavior need tests. |
| `/` hold prefix | Partial | Used in common commands. | Syntax coverage is incomplete. |

Issue #79 was caused in the production matcher, not by State -1 route ordering. During a single `D -> DF -> F+a` motion, several held `DF` frames could each satisfy both cardinal `D` and `F`. That made T-H-M-A's `~D, F, D, F, a` super command active alongside its normal `~D, DF, F, a` command. The matcher now rejects adjacent, different cardinal steps when both are satisfied only by reusing the same unchanged diagonal direction. Exact `DF` steps, `$`/`/` hold commands, release commands, and lenient final-direction-plus-button input remain covered by focused tests.

## Common routing policy

`public/chars/common.cmd` is intentionally part of the WebMUGEN compatibility layer.

It should contain visible baseline routes for common behavior such as:

- stand to crouch;
- crouch hold/release;
- jump start and jump velocity glue;
- walk forward/back routes;
- temporary VelSet/ChangeAnim glue required while full common1/runtime semantics are incomplete.

Do not move these rules into hidden TypeScript logic unless they are truly engine semantics.

The walk-forward and walk-back routes intentionally skip dash/run states `100`
through `107`. This keeps a held direction from converting a character dash
substate such as `101` into State `20` through the common `Statedef -1` route.

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
