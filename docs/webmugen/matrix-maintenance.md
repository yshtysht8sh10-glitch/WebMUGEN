# Compatibility Matrix Maintenance

Updated: 2026-07-12

This document defines how to maintain the WebMUGEN compatibility matrix.

## Source of truth

`docs/webmugen/winmugen-compatibility-matrix.html` is the canonical checklist.

`docs/webmugen/winmugen-compatibility-matrix.md` is the row inventory and human-readable evidence mirror. The HTML reads the Markdown inventory and adds the detailed status model, explicit overrides, progress badges, filters, and summaries.

Update both whenever compatibility behavior changes. When a row needs a special classification or progress value, update the HTML override table and the Markdown note together.

## Status meanings

| Status | Meaning | Progress |
|---|---|---:|
| Complete | Implemented through the intended WinMUGEN-compatible runtime path and covered by focused tests or confirmed runtime usage. | 100% |
| Partial NN% | Implemented through the intended path, but parameters, edge cases, subsystem integration, tests, or diagnostics remain incomplete. | 1–99% |
| Fallback NN% | A different or approximate path provides some behavior, but it is not yet the intended WinMUGEN-compatible implementation. | 1–99% |
| Safe no-op | Parser/runtime recognizes the item and avoids a crash, but applying it has no game effect. | 0% |
| Issue ready | Implementation has not started, but a GitHub Issue defines scope, completion criteria, and tests. | 0% |
| Not started | No implementation, compatibility shim, or prepared Issue has been confirmed. | 0% |
| Audit needed | Related code may exist, but runtime integration, compatibility, or test evidence has not been verified. | unknown |

Do not combine these meanings under a generic `Partial` label.

## Fallback terminology

Use **Fallback** for an implementation that produces some behavior using a different route from the intended WinMUGEN-compatible route.

Examples:

- fixed 44x80 push boxes instead of Width/AIR collision-derived boxes;
- a TypeScript recovery shortcut instead of the normal common-state/GetHitVar flow;
- a separate Explod, Helper, or Projectile prototype that is not connected to the CNS Controller runtime.

Do not use `polyfill` for this category. Polyfill normally means recreating a missing API with the same public contract; these implementations are usually approximations or temporary alternative paths.

## Progress scoring

`Partial` and `Fallback` progress is compatibility completeness, not elapsed work time.

Score five areas, normally 0, 10, or 20 points each:

1. Parse / Load — syntax and assets are read and retained correctly.
2. Runtime semantics — trigger, controller, state, or subsystem semantics execute correctly.
3. Game integration — the feature reaches physics, animation, collision, renderer, audio, round flow, or other required game path.
4. Tests — focused unit or integration tests cover the behavior.
5. Diagnostics and docs — Runtime History/Debug Overlay evidence and relevant documentation exist.

The sum is the displayed percentage. Adjustments are allowed when a feature has a materially larger unsupported parameter surface, but the note must explain why.

Examples:

- parser only: `Partial 20%`;
- parser plus runtime field storage: `Partial 30–40%`;
- game behavior works for common cases but advanced parameters and tests are incomplete: `Partial 60–80%`;
- name recognition only: `Safe no-op`, never `Partial 10%`;
- fixed-box approximation with tests: `Fallback NN%`.

## Complete requirements

A row can be promoted to Complete only when all of the following are true for the documented scope:

- the intended runtime path performs the behavior;
- focused tests or a confirmed app integration path exercise it;
- known unsupported parameters and semantic branches are absent or split into separate rows;
- diagnostics and documentation are sufficient to debug failures.

Do not mark Complete only because:

- KFM happens to work;
- the screen looks correct once;
- a parser accepts the syntax;
- a safe default avoids crashes;
- a Controller is recognized but ignored;
- a separate prototype implements a superficially similar effect.

An intentional WinMUGEN no-op may be Complete only when the original behavior is itself a no-op and that fact is verified. A WebMUGEN safe compatibility no-op is `Safe no-op`.

## Notes format

For `Partial` and `Fallback`, Notes must identify what works and what remains.

Preferred form:

```text
Implemented: ... Missing: ... Evidence: tests/runtime path/Issue/commit.
```

For `Issue ready`, include the Issue number:

```text
Issue ready — #30, prerequisites #25/#31/#32.
```

For `Safe no-op`, state explicitly that there is no game-state effect:

```text
Recognized by CNS runtime; returns executed without changing game state.
```

For `Audit needed`, identify what must be inspected:

```text
Separate subsystem may exist; CNS runtime connection and focused tests are unverified.
```

Avoid vague notes such as `Supported`, `Partial support`, or `Needs work`.

## Explicit overrides

The HTML contains an override map for rows whose status cannot be inferred safely from legacy Markdown wording.

Use explicit overrides for:

- major aggregate features such as HitDef;
- known Fallback implementations such as fixed-box PlayerPush;
- features with prepared Issues such as Explod/Sound Controllers;
- rows whose progress depends on multiple subsystems or Issues;
- entries where old notes use `Partial` for a safe no-op or placeholder.

Keep the override note honest and update it when the underlying implementation changes.

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

1. Pick one matrix item or one tightly related Issue.
2. Audit the current parser/runtime/game path before changing its status.
3. Implement the minimal compatible behavior.
4. Add focused tests.
5. Update the Markdown evidence note.
6. Update the HTML status override/progress when needed.
7. Update the related topic note.
8. Run `npm test -- --run`.
9. Commit.
10. Move to the next item.

## Validation checklist

Before committing a Matrix update, verify:

- every displayed status is one of the seven canonical statuses;
- every `Partial` and `Fallback` has a percentage from 1 to 99;
- every `Issue ready` note contains an Issue number;
- every `Safe no-op` note says that no game effect occurs;
- Fallback is not used merely because a feature is incomplete;
- Complete rows have focused-test or confirmed-runtime evidence;
- HTML loads and parses the Markdown inventory;
- search, section filter, and status filter still work;
- `public/chars/common1.cns` is unchanged.

## Commit scope

Prefer one compatibility item per implementation commit. Matrix-only taxonomy changes may update the HTML, Markdown notes, and this maintenance policy together.

Do not mix unrelated debug UI or gameplay changes into a Matrix taxonomy commit.

## Topic notes

When a change affects an area, update the corresponding topic note:

- StateDef header fields → `state-def-header-notes.md`
- Triggers → `trigger-compatibility-notes.md`
- Controllers → `state-controller-compatibility-notes.md`
- CMD → `cmd-compatibility-notes.md`
- Pipeline/debug behavior → `runtime-pipeline.md`, `debug-overlay.md`, `runtime-history.md`
- Physics/Fallback behavior → `physics.md`
- Matrix status policy → this document

## Build caveat

If `npm run build` fails because of known TypeScript configuration issues, report it separately from compatibility work.

Still run `npm test -- --run` for compatibility implementation changes. A documentation-only Matrix taxonomy update should at minimum validate that the HTML script has no syntax error and that the Markdown file is reachable from the HTML location.
