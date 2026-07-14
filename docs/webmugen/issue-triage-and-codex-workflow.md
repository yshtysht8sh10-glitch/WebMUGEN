# Issue Triage and Codex Workflow

Updated: 2026-07-15

## Purpose

Reduce Codex credit consumption by separating investigation and design from execution-heavy verification.

The default workflow is **ChatGPT-first triage, Codex-last verification**.

## Roles

### ChatGPT primary response

ChatGPT performs as much low-cost work as possible before Codex starts:

1. Read the Issue, related Issues, recent commits, documentation, and compatibility Matrix.
2. Classify the symptom by runtime area rather than searching the entire repository.
3. Identify the smallest likely execution path and the most relevant files/functions.
4. Distinguish confirmed facts, likely causes, and unverified hypotheses.
5. Propose a minimal WinMUGEN-compatible correction.
6. Apply safe, reviewable source/document changes when the cause is sufficiently clear.
7. Do not claim tests or real-game verification that were not run.
8. Record remaining uncertainty and prepare a bounded Codex instruction.

ChatGPT should avoid broad speculative changes, character-specific workarounds, fixed pixel compensation without a WinMUGEN basis, and edits to `public/chars/common1.cns`.

### Codex verification and completion

Codex starts after the primary response and should focus on execution rather than rediscovery:

1. Read the Issue and ChatGPT primary-response comment first.
2. Inspect only the listed files/functions initially.
3. Review the proposed patch before expanding the search area.
4. Add or update focused tests.
5. Run the focused tests first.
6. Correct the implementation only when tests or actual runtime behavior show it is still wrong.
7. Run the full test suite once the focused path is stable.
8. Perform real-game verification when the Issue requires it.
9. Update documentation and the HTML Compatibility Matrix canonical source.
10. Synchronize the Markdown Matrix mirror.
11. Commit, push, comment on the Issue, and close only when completion criteria are met.

## Issue processing order

Prefer grouping work by shared root cause, while still completing and closing Issues individually.

Typical groups:

- Input: CMD parser, input history, matcher, State -1, `ctrl`, fallback controls.
- Physics: character constants, jump, gravity, friction, Push Box, facing.
- Audio: AudioContext unlock, event adapter, PlaySnd, HitDef sounds.
- Rendering: AIR/SFF ownership, SpritePack, Explod, missing-asset behavior.
- Runtime entities: Helper, Projectile, Explod lifecycle and ownership.

When several Issues share a path, investigate the path once and reuse evidence. Do not combine unrelated completion criteria into one close operation.

## Required primary-response note

Before Codex begins, add an Issue comment containing:

- observed symptom;
- confirmed current behavior;
- likely root cause and confidence;
- files/functions already inspected;
- changes already applied;
- tests not run;
- exact focused tests Codex must add or run;
- real-game verification steps;
- stop conditions;
- documentation and Matrix rows to update.

## Credit-saving rules

- Do not repeatedly search the whole repository.
- Start with Issue evidence, call chain, and recent relevant commits.
- Do not run the full test suite after every small edit.
- Run focused tests while iterating, then one full run after stabilization.
- Do not regenerate documents or inventories unrelated to the Issue.
- Do not reopen settled architecture questions without contradictory evidence.
- Do not replace a clear localized fix with a broad refactor.
- Do not use exploratory browser/runtime loops when a deterministic unit test can isolate the behavior.

## Test and verification honesty

ChatGPT may prepare or modify tests but must state when they were not executed.

An Issue must not be closed solely because:

- the source patch looks correct;
- parser support exists;
- a safe no-op avoids a crash;
- a focused test was added but not run;
- a synthetic test passes while the real-game path remains unverified.

## Git and Issue lifecycle

For each Issue:

1. `git pull --rebase`
2. inspect the primary-response note
3. implement or review the minimal correction
4. run focused tests
5. run full tests once stable
6. perform real-game verification
7. update documentation
8. update HTML Matrix canonical
9. synchronize Markdown mirror
10. commit
11. push
12. add an Issue completion comment
13. close the Issue

If the remote changed during work:

1. `git pull --rebase`
2. resolve conflicts narrowly
3. `git rebase --continue`
4. rerun affected focused tests
5. `git push`

## Stop conditions

Codex may stop and request clarification only for:

- unclear WinMUGEN behavior that changes the design;
- missing required character/assets or an unreproducible report;
- a major architecture change beyond the Issue scope;
- a meaningful conflict on `main` that cannot be resolved safely;
- contradictory real-game evidence.

Ordinary test failures, small merge conflicts, and an initially incorrect patch are not stop conditions. Fix them and continue.

## Compatibility classification

Use only evidence-backed states:

- `Complete`
- `Partial (%)`
- `Fallback`
- `Safe no-op`
- `Issue ready`
- `Not started`
- `Audit needed`

Parser-only support, unexecuted tests, or unverified runtime paths must not be marked `Complete`.
