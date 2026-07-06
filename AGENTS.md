# WebMUGEN Agent Instructions

This file is for Codex and other AI coding agents working in this repository.

Before making changes, read these documents:

- `docs/webmugen/development-policy.md`
- `docs/webmugen/runtime-pipeline.md`
- `docs/webmugen/loader.md`
- `docs/webmugen/runtime.md`
- `docs/webmugen/trigger.md`
- `docs/webmugen/controller.md`
- `docs/webmugen/physics.md`
- `docs/webmugen/animation.md`
- `docs/webmugen/debug-overlay.md`
- `docs/webmugen/runtime-history.md`
- `docs/webmugen/matrix-maintenance.md`
- `docs/webmugen/implementation-inventory.md`
- `docs/webmugen/testing-policy.md`

## Project goal

WebMUGEN is not a KFM-only demo.

The goal is WinMUGEN compatibility: existing WinMUGEN characters should run in the browser with behavior as close to WinMUGEN as practical.

Compatibility comes before convenience, shortcuts, or local KFM-only fixes.

## Non-negotiable rules

### Never modify `public/chars/common1.cns`

`public/chars/common1.cns` is treated as a WinMUGEN compatibility asset.

Do not edit it to work around WebMUGEN runtime bugs.

Fix the engine side instead:

- Loader
- Parser
- Runtime
- Trigger evaluator
- Controller executor
- Physics
- Animation
- Debug diagnostics
- Tests

### Grow `public/chars/common.cmd`

`public/chars/common.cmd` is WebMUGEN's visible common control layer.

When common WinMUGEN-style behavior can be expressed as MUGEN data, prefer putting it in `common.cmd` rather than hiding it in TypeScript.

Examples:

- crouch routing
- jump routing
- walk routing
- temporary VelSet / ChangeAnim glue while full common-state semantics are incomplete

### TypeScript is the execution engine, not the rulebook

TypeScript should parse, load, evaluate, and execute MUGEN data.

Do not add KFM-specific or state-number-specific hacks unless they are true engine semantics and cannot reasonably be represented as CNS/CMD data.

## Compatibility matrix

`docs/webmugen/winmugen-compatibility-matrix.html` is the canonical compatibility checklist.

`docs/webmugen/winmugen-compatibility-matrix.md` is the human-readable mirror.

When compatibility changes, update both.

Status meanings:

- Complete: implemented and verified by focused tests or confirmed runtime integration.
- Partial: simple cases, approximations, safe defaults, field storage, or recognized no-ops.
- Unsupported: no meaningful implementation.
- Untested: implementation may exist, but behavior is not verified.

Do not mark Complete just because KFM appears to work.

Do not mark Complete for a safe no-op unless explicit no-op behavior is the intended feature and is tested/documented.

## Required work cycle

When asked to improve compatibility, do this loop:

1. Read the matrix.
2. Pick ONE Unsupported, Partial, or Untested item.
3. State which item you picked.
4. Implement the minimal compatible behavior.
5. Add or update focused tests.
6. Update `winmugen-compatibility-matrix.html`.
7. Update `winmugen-compatibility-matrix.md`.
8. Update the relevant topic document if behavior or limitations changed.
9. Run `npm test -- --run`.
10. Commit the one item.
11. Immediately continue with the next matrix item until the requested task or available context is exhausted.

Do not stop after only one small compatibility item unless explicitly requested.

## Topic document mapping

Update these documents when relevant:

- StateDef header fields: `docs/webmugen/state-def-header-notes.md`
- Triggers: `docs/webmugen/trigger-compatibility-notes.md` and `docs/webmugen/trigger.md`
- State Controllers: `docs/webmugen/state-controller-compatibility-notes.md` and `docs/webmugen/controller.md`
- CMD features: `docs/webmugen/cmd-compatibility-notes.md`
- Loader behavior: `docs/webmugen/loader.md`
- Runtime pipeline: `docs/webmugen/runtime-pipeline.md` and `docs/webmugen/runtime.md`
- Physics: `docs/webmugen/physics.md`
- Animation: `docs/webmugen/animation.md`
- Debug UI/history: `docs/webmugen/debug-overlay.md` and `docs/webmugen/runtime-history.md`
- Matrix process: `docs/webmugen/matrix-maintenance.md`

## Debugging policy

When a route fails, do not guess. Make the failing layer visible.

Inspect in this order:

1. Input
2. Command
3. Trigger
4. State
5. Controller
6. StateDef header
7. Physics
8. Animation
9. Collision / hit
10. Rendering

If necessary, improve Debug Overlay or Runtime History before changing compatibility logic.

## Testing policy

Run:

```bash
npm test -- --run
```

Add focused tests whenever possible.

For state routes, assert runtime state directly, not only visual output.

Good assertions include:

- input / resolved command
- before and after `stateNo`
- `stateType`, `moveType`, `physics`, `ctrl`
- `animNo`, `animTime`
- position / velocity
- facing / power / juggle when relevant

`npm run build` may fail because of known TypeScript configuration issues such as TS5107. If so, report whether the failure is pre-existing or caused by your change.

## Commit policy

Prefer one compatibility item per commit.

Commit message examples:

- `Implement BodyDist X trigger compatibility`
- `Implement facep2 StateDef compatibility`
- `Add command buffer time tests`
- `Update compatibility matrix for AnimExist`

Do not mix unrelated debug UI, docs, and compatibility changes unless they are part of the same item.

## Forbidden shortcuts

Do not:

- edit `public/chars/common1.cns`;
- add KFM-only behavior;
- hide common movement rules in TypeScript when `common.cmd` is appropriate;
- update code without matrix updates;
- update matrix without tests or honest notes;
- mark Partial behavior as Complete;
- lump many unrelated items into one vague commit;
- remove diagnostics that are needed to understand the runtime pipeline.

## Preferred next-item strategy

When choosing the next item, prefer small, testable matrix rows:

1. StateDef header fields close to existing state entry logic.
2. Simple triggers close to existing trigger context.
3. State Controllers that mutate only `PlayerState` fields.
4. CMD timing or syntax features with focused tests.
5. Debug improvements that reveal where a route fails.

Large systems such as HitDef, guard, Helper, Projectile, Explod, Target, pause/superpause, and full collision should be split into smaller observable milestones.
