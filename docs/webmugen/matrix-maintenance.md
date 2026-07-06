# Compatibility Matrix Maintenance

Updated: 2026-07-06

This document defines how to maintain the WebMUGEN compatibility matrix.

## Source of truth

`docs/webmugen/winmugen-compatibility-matrix.html` is the canonical checklist.

`docs/webmugen/winmugen-compatibility-matrix.md` is the human-readable mirror with detailed notes.

Update both whenever compatibility status changes.

## Status meanings

| Status | Meaning | Example |
|---|---|---|
| Complete | Implemented and covered by focused tests or confirmed runtime integration. | `VelSet` basic numeric velocity set. |
| Partial | Simple cases, approximation, safe default, field storage, or safe no-op. | `AfterImage` recognized but visual effect missing. |
| Unsupported | Not implemented and no meaningful shim exists. | `PlayerIDExist` before player id lookup exists. |
| Untested | Implementation may exist but behavior has not been verified. | `command.time` before parser/runtime tests. |

## Complete requirements

A row can be promoted to Complete only when at least one is true:

- focused unit/regression tests verify the behavior;
- a known runtime integration path exercises the behavior and Debug Overlay can inspect it;
- the item is intentionally a no-op and that no-op is tested or clearly documented.

Do not mark Complete only because:

- KFM happens to work;
- the screen looks correct once;
- a parser accepts the syntax;
- a safe default avoids crashes;
- a controller is recognized but ignored.

## Partial examples

Use Partial for:

- parser support without full runtime behavior;
- runtime field storage without subsystem integration;
- safe no-op recognition;
- deterministic placeholders such as fixed random values;
- approximated distances or constants;
- behavior that works for KFM but is not yet WinMUGEN-audited.

## One item per row

Do not combine multiple triggers, controllers, states, operators, redirects, or CMD features into one matrix item.

Good:

```text
BodyDist X
BodyDist Y
P2BodyDist X
P2BodyDist Y
```

Bad:

```text
Distance triggers
```

## Work cycle

1. Pick one matrix item.
2. Implement the minimal compatible behavior.
3. Add focused tests.
4. Update HTML matrix.
5. Update Markdown matrix.
6. Update topic note if behavior or limitation changed.
7. Run `npm test -- --run`.
8. Commit.
9. Move to the next item.

## Commit scope

Prefer one compatibility item per commit.

A small related group is acceptable when splitting would be artificial, for example a parser/runtime/test trio for the same field.

Do not mix unrelated debug UI changes into a matrix compatibility commit.

## Notes format

Matrix notes should be short and honest.

Good:

```text
Parsed and applied once when entering a state.
```

Good:

```text
Uses opponent center distance; precise body-edge width is incomplete.
```

Bad:

```text
Supported.
```

Bad when not fully true:

```text
Fully WinMUGEN compatible.
```

## Topic notes

When a change affects an area, update the corresponding topic note:

- StateDef header fields → `state-def-header-notes.md`
- Triggers → `trigger-compatibility-notes.md`
- Controllers → `state-controller-compatibility-notes.md`
- CMD → `cmd-compatibility-notes.md`
- Pipeline/debug behavior → `runtime-pipeline.md`, `debug-overlay.md`, `runtime-history.md`

## Build caveat

If `npm run build` fails because of known TypeScript configuration issues, report it separately from compatibility work.

Still run `npm test -- --run` for compatibility changes.
