# WebMUGEN Development Policy

Updated: 2026-07-06

## Purpose

WebMUGEN aims to run WinMUGEN characters in the browser with high compatibility.

The goal is not only to make KFM move. The goal is to preserve the behavior expected by existing WinMUGEN characters as much as possible.

Compatibility comes before convenience, local shortcuts, or KFM-only fixes.

## Non-negotiable rules

### Do not modify `public/chars/common1.cns`

`public/chars/common1.cns` is treated as a WinMUGEN compatibility asset.

Do not edit it to satisfy WebMUGEN runtime limitations.

If behavior differs from WinMUGEN, fix the WebMUGEN side instead:

- loader
- parser
- runtime
- trigger evaluator
- state controller execution
- physics
- command routing
- renderer integration
- tests and diagnostics

Changing `common1.cns` hides engine bugs and makes compatibility regressions harder to reproduce.

### Grow `public/chars/common.cmd`

`public/chars/common.cmd` is WebMUGEN's common control layer.

When a common WinMUGEN movement or baseline route can be expressed as MUGEN data, prefer writing it in `common.cmd` instead of hard-coding it in TypeScript.

This keeps common behavior visible, debuggable, and closer to the MUGEN file model.

Examples of behavior that belongs in `common.cmd` when practical:

- common stand/crouch/jump/walk routing
- common fallback ChangeState routes
- common VelSet / ChangeAnim glue required by browser runtime integration

### TypeScript is the execution engine, not the rulebook

TypeScript should parse, load, evaluate, and execute MUGEN definitions.

Avoid adding hidden KFM-specific or state-number-specific behavior in TypeScript unless the behavior is genuinely part of engine semantics and cannot reasonably be represented as CNS/CMD data.

Acceptable TypeScript responsibilities include:

- parsing CNS/CMD/AIR/DEF
- merging character data with common data
- evaluating triggers
- executing state controllers
- stepping physics
- exposing debug diagnostics
- providing safe compatibility shims when a full subsystem is not ready

## Loader policy

Character loading must preserve both character-local behavior and WebMUGEN common behavior.

For CMD:

- load the character CMD
- load `public/chars/common.cmd`
- merge them
- character command/state routes should take precedence when they define the same primary route
- common routes should fill missing baseline behavior

For CNS:

- load character CNS files
- load `public/chars/common1.cns` externally
- do not embed a separate copy of `common1.cns` into TypeScript
- do not patch `common1.cns` for engine convenience

## Runtime and trigger policy

Runtime behavior should be observable in this order:

1. input
2. command resolution
3. trigger evaluation
4. state selection
5. state controller execution
6. state header application
7. physics
8. animation
9. collision / hit resolution
10. rendering

When debugging a route, make the failing layer visible before guessing.

For trigger support:

- implement triggers one at a time
- keep matrix rows one item per trigger
- do not mark a trigger Complete because a safe default exists
- safe default / approximation / partial parser support is Partial

For state controllers:

- implement and track one controller per matrix row
- safe no-op recognition is Partial, not Complete
- Complete requires behavior coverage or a clearly documented intentional no-op

## Compatibility matrix policy

`docs/webmugen/winmugen-compatibility-matrix.html` is the canonical compatibility checklist.

`docs/webmugen/winmugen-compatibility-matrix.md` is the human-readable mirror with more detailed notes.

When implementation or tests change, update both files in the same work cycle.

Do not combine multiple compatibility items into one row.

Status meanings:

- Complete: behavior is implemented and covered by focused tests or a confirmed runtime integration path.
- Partial: simple cases, approximations, safe defaults, recognized no-ops, or incomplete subsystem integration.
- Unsupported: no implementation or shim.
- Untested: likely implementation exists or is plausible, but behavior has not been verified.

Never promote an item to Complete only because the screen appears correct.

## Testing policy

Follow `docs/webmugen/testing-policy.md`.

Each compatibility change should add focused tests when possible.

Movement/state route tests should assert runtime state directly, not only visual output.

A good movement assertion includes:

- input and resolved commands
- before and after state number
- state type / physics / ctrl
- animation number and animation time
- position / velocity
- facing when relevant

If a manual screen check and a unit test disagree, treat it as an integration bug and add diagnostics at the failing layer.

## Debug overlay policy

The Debug Overlay and runtime history are part of the compatibility workflow.

When a route is confusing, add diagnostics that show the actual pipeline rather than relying on guesswork.

Useful diagnostics include:

- current commands
- candidate ChangeState routes
- triggerall result
- triggerN group result
- final shouldRun result
- executed controller list
- state before and after controller execution
- physics state after CNS runtime

Keep long-term diagnostics useful, but remove or narrow noisy temporary logs once the bug is understood.

## Git / Codex workflow

Use small commits.

Prefer one compatibility item per commit, or one tightly related set when splitting would be artificial.

Recommended work cycle:

1. choose one matrix item
2. inspect implementation and tests
3. implement minimal compatible behavior
4. add or update focused tests
5. update HTML and Markdown matrix
6. run `npm test -- --run`
7. commit
8. move to the next item

If `npm run build` fails because of known TypeScript configuration issues, report that separately from the compatibility change.

Do not mix unrelated local debugging changes into compatibility commits.

## Current near-term focus

Small compatibility items are preferred over large speculative rewrites.

Good next targets are usually:

- StateDef header fields close to existing runtime data
- simple triggers close to existing trigger context
- state controllers that can be implemented without Helper/Projectile/Target subsystems
- CMD timing features with focused tests

Large systems such as HitDef, collision, guard, Helper, Projectile, Explod, Target, and full pause/superpause should be split into smaller observable milestones.
