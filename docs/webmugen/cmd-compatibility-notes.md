# CMD Compatibility Notes

Updated: 2026-07-06

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
| Direction sequences | Partial | Command matcher exists. | WinMUGEN timing and edge syntax need audit. |
| Button sequences | Partial | Basic support; simple button commands are kept briefly active. | Full sequence timing and cancel windows need audit. |
| Simultaneous buttons | Partial | Basic syntax exists. | Full parsing/timing behavior needs audit. |
| Release commands | Untested | `~` syntax needs verification. | Important for real character CMD compatibility. |
| Buffer time | Partial | InputBuffer exists and default buffering covers simple buttons/double-tap directions. Double-tap directions do not retrigger while the second direction is held. | Exact WinMUGEN timing still needs audit. |
| `command.time` | Untested | Parser/runtime status needs verification. | Must be tested separately from buffer time. |
| `command.buffer.time` | Partial | Parser and matcher honor explicit post-match active window; double-tap direction buffering applies after release, not during a held second tap. | Exact WinMUGEN behavior still needs audit. |
| `$` direction match | Partial | KFM hold commands work. | Full syntax and facing-relative behavior need tests. |
| `/` hold prefix | Partial | Used in common commands. | Syntax coverage is incomplete. |

## Common routing policy

`public/chars/common.cmd` is intentionally part of the WebMUGEN compatibility layer.

It should contain visible baseline routes for common behavior such as:

- stand to crouch;
- crouch hold/release;
- jump start and jump velocity glue;
- walk forward/back routes;
- temporary VelSet/ChangeAnim glue required while full common1/runtime semantics are incomplete.

Do not move these rules into hidden TypeScript logic unless they are truly engine semantics.

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
