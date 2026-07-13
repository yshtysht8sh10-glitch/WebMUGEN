# WebMUGEN Testing Policy

Updated: 2026-07-06

## Purpose

WebMUGEN prioritizes WinMUGEN compatibility. Manual confirmation in the game screen is useful, but it must not be the only way to decide whether a movement or state transition works.

This policy is a companion to `docs/webmugen/development-policy.md`. The development policy defines the project rules; this document defines how compatibility work should be verified.

For every basic movement, command route, trigger, and controller implementation, add focused tests that confirm the expected state transition and expose enough diagnostics to identify where the route failed.

## State transition tests

When implementing or fixing a movement/state route, the test must confirm the actual target state number.

Examples:

- Stand idle: neutral input keeps `stateNo = 0`.
- Crouch start: pressing down from stand enters `stateNo = 10`.
- Crouch hold: holding down after crouch start enters or keeps `stateNo = 11`.
- Crouch end: releasing down from crouch enters `stateNo = 12`.
- Walk: holding left/right enters the expected walking state and velocity direction.
- Attack: pressing attack enters the expected attack state and applies the expected control flag.

Do not mark a basic movement route as complete only because the screen appears to move. The test must check the runtime state directly.

## Diagnostic logs

Regression tests for state routing should print frame-by-frame diagnostics when they fail.

Each diagnostic frame should include:

- frame label / intent
- input values: `left`, `right`, `up`, `down`, `attack`, buttons, command names
- state before stepping: `stateNo`, `stateTime`, `stateType`, `moveType`, `physics`, `ctrl`, `animNo`, `animTime`, position, velocity, facing
- state after stepping with the same fields

The goal is that a failing test log can answer where the route broke:

1. Input was not set.
2. Command was not resolved.
3. Trigger did not become true.
4. ChangeState did not run.
5. State header did not apply.
6. Physics or animation overwrote the result.

## Compatibility matrix rule

`docs/webmugen/winmugen-compatibility-matrix.html` is the canonical compatibility checklist.

`docs/webmugen/winmugen-compatibility-matrix.md` is the human-readable mirror with more detailed notes.

Update both files when implementation or tests change.

A row should be promoted to **Complete** only when at least one of the following is true:

- a focused unit/regression test verifies the behavior;
- the behavior is exercised by a known runtime integration path and can be inspected through Debug Overlay;
- the item is intentionally a no-op and the no-op behavior is tested or explicitly documented.

When a behavior is implemented but not yet covered by tests or runtime verification, keep it **Partial**.

Safe defaults, placeholder values, compatibility shims, and recognized no-ops are **Partial** unless the no-op itself is the intended behavior and is covered by tests or documentation.

## Manual game-screen verification

Manual checks are still important for rendering and feel.

For game-screen checks, use Debug Overlay to compare:

1. Input
2. Command
3. Trigger
4. State
5. Controller
6. Physics
7. Animation
8. Collision
9. Rendering

If the screen behavior and UnitTest result disagree, treat that as an integration bug and add a new test at the layer where the mismatch occurs.

## External real-character regression

The repository bundles fewer than three independent characters, so the optional `RealCharacterHitDefRegression.test.ts` suite accepts external `.def` paths through `WEBMUGEN_REAL_CHARACTER_DEFS`. It must be run with at least three structurally different WinMUGEN characters before a broad HitDef compatibility audit is considered complete. External character assets are not copied into the repository.

The suite uses production loading, real CNS HitDef parameter maps, and real AIR collision elements, while forcing the selected controller trigger for deterministic isolation. It must cover both player roles, both Facing directions, ground/air/guard/KO/edge contact, recovery diagnostics, and Matrix presence for every observed controller and HitDef parameter. See `hitdef-real-character-regression.md` for the current evidence and limitations.

Broad Explod/Sound audits use `RealCharacterExplodSoundRegression.test.ts` with the same environment variable and three-character minimum. They must resolve a real SND sample and owner AIR Explod for each character, cover P1/P2 and both Facings, run a bounded lifecycle, and audit all seven Explod/Sound Matrix rows individually. ZIP loading, Audio cleanup, round reset, and UI tab retention are companion gates; see `explod-sound-real-character-regression.md`.
