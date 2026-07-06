# WebMUGEN Documentation Audit

Updated: 2026-07-06

## Result

The compatibility matrix has been updated for recent Codex work, but the smaller topic documents were either missing or too thin to reflect current development policy.

This audit adds the missing topic-level notes and links them to the matrix/policy workflow.

## Checked documents

| Document | Result |
|---|---|
| `docs/webmugen/winmugen-compatibility-matrix.html` | Updated and still treated as canonical. |
| `docs/webmugen/winmugen-compatibility-matrix.md` | Updated with detailed notes for recent items. |
| `docs/webmugen/testing-policy.md` | Updated to align with `development-policy.md`. |
| `docs/webmugen/development-policy.md` | Added to capture project philosophy. |
| `docs/webmugen/state-def-header-notes.md` | Added. |
| `docs/webmugen/trigger-compatibility-notes.md` | Added. |
| `docs/webmugen/state-controller-compatibility-notes.md` | Added. |
| `docs/webmugen/cmd-compatibility-notes.md` | Added. |
| `docs/mugen-spec/winmugen/*.html` | Existing spec notes are high-level and not sufficient as implementation-status docs. Keep them as spec notes, not compatibility status sources. |

## Main gaps found

1. The matrix reflected recent work, but topic-level documents did not explain what Complete vs Partial means per area.
2. There was no standalone document preserving the WebMUGEN development philosophy.
3. CMD/common route behavior was not documented clearly enough, especially the distinction between entering a state and actually driving velocity/animation.
4. StateDef header fields such as `poweradd`, `juggle`, and `facep2` needed a single reference page.
5. Recent trigger work such as `BodyDist X/Y`, `AnimExist`, `SelfAnimExist`, and `AnimElemNo` needed current notes.
6. State Controller safe no-op behavior needed an explicit Partial-vs-Complete rule.

## Policy going forward

When a compatibility item changes, update the docs in this order:

1. implementation and tests;
2. `winmugen-compatibility-matrix.html`;
3. `winmugen-compatibility-matrix.md`;
4. the relevant topic note, if the behavior or limitation changed;
5. `testing-policy.md` or `development-policy.md` only if the rules changed.

Do not treat `docs/mugen-spec/winmugen/*.html` as live implementation status. Those pages are short spec notes. Use the matrix and topic notes for current support status.
