# Runtime History

Updated: 2026-07-09

Runtime History is the persistent frame-by-frame diagnostic log shown in the Debug UI.

## Purpose

Live debug values are useful, but they change every frame. Runtime History preserves important snapshots so a transition can be inspected after it has already happened.

This is especially important for short routes such as:

- State 0 → State 10 crouch start;
- State 10 → State 11 crouch hold;
- State 0 → State 20 walk;
- State 40 → State 50 jump;
- attack startup and cancel windows.

## Snapshot rule

Runtime History entries must be immutable snapshots.

Do not store references to mutable arrays or objects that will change on the next frame.

When appending history, convert lines to plain strings at that moment.

Correct concept:

```text
history entry = String(line values at frame N)
```

Incorrect concept:

```text
history entry = reference to current live debug array
```

If old history changes when current input changes, the snapshot rule is broken.

## Debug UI tabs

Runtime history is split into two top-level tabs:

- `実行履歴人間用`: a compact rendered view for following StateNo, AnimNo, key input, State状況, and recent damage.
- `実行履歴AI用`: a dense copyable log intended for Codex/debug analysis.

The old nested runtime-history subtabs were removed so runtime logs are available directly from the main debug tab row.

## When to append

History should append when something useful happens, such as:

- input is active;
- command names are active;
- state changes;
- animation changes;
- controller executes;
- debug trace exists;
- physics state changes meaningfully.

Avoid recording completely idle duplicate frames forever.

For the human-facing runtime history, capture the snapshot immediately after CNS execution and before physics increments `stateTime` / `animTime`. This keeps `Time = 0` routes visible when a StateDef is entered, while the stage overlay can still show the post-physics live state.

## Signature / deduplication

A history signature can prevent identical repeated entries.

The signature should be based on the snapshot text, not mutable data references.

If a line changes every frame due only to time counters, decide whether that is useful. During movement debugging, state time can be useful. During idle debugging, it may create noise.

The human-facing history is capped by both entry count and rendered line count. Long State状況 sections keep ChangeState / ChangeAnim candidates visible first, then only a small number of additional controllers. This prevents large characters from making the browser heavy while preserving the most useful routing diagnostics.

## Render window

Runtime history storage and runtime history rendering use separate limits.

- Stored history is capped by entry count so copy/debug data can remain available.
- Rendered history is capped to the current visible window so the Debug UI does not create a huge DOM.

The visible window has two modes:

- `latest`: render only the newest 50 runtime-history entries.
- `aroundFrame`: render entries around a selected frame.

When a StateNo transition link points at an old frame, the UI first switches the visible window to `aroundFrame` for that target frame, then scrolls the matching entry into view after React renders it. The Debug UI should show the current mode, entry range, visible entry count, total retained entry count, and whether the target frame was retained.

The retained history lives outside React state. React state tracks only the current window mode and a small version counter, so appending a log does not copy thousands of retained lines through React. Latest-window selection also stops scanning once enough recent entries are known for large logs.

Runtime-history rendering is throttled while the game is running. Appends are still stored immediately, but the React-visible version counters are invalidated on a short timer instead of every frame. Jumping to a StateNo transition or returning to the latest window invalidates immediately so navigation remains responsive.

Rendered output is capped by both entry count and line count. This matters for large characters where a single human-readable entry can contain many State status rows. When the latest window exceeds the rendered-line cap, the UI keeps the newest lines and adds a truncation marker; full retained logs remain available from the copy action.

Copy actions are split between visible logs and all retained logs. Visible-copy operations should stringify only the current rendered slice; all-log copy may stringify the full retained history on demand.

## Entry format

Preferred format:

```text
---- 23:59:55 frame=899 ----
  keys=ArrowRight
  cmd p1=fwd,holdfwd
  phys p1 state=20 ... vel=(2.4,0) anim=20:4
  cns p1 state=0->20 ... exec=ChangeState,VelSet,ChangeAnim
```

Keep it copyable and grep-friendly.

## What to look for

| Symptom in history | Interpretation |
|---|---|
| `keys` correct but `cmd` missing | command matching issue. |
| `cmd` correct but `cns exec=-` | trigger/controller route issue. |
| `state=20` but `vel=(0,0)` | movement state entered but motion not applied. |
| state transition shown once then overwritten | later negative/current state or physics integration may be reverting it. |
| old history changes after new input | snapshot bug. |

## Copy workflow

When asking for help, copy the full debug dump rather than only a screenshot.

The dump should include:

- current live values;
- static route lists;
- runtime history around the failing action;
- investigation notes when relevant.

## Maintenance

Runtime History is a debugging tool. Keep it reliable before making it fancy.

Useful future improvements:

- filtering by player;
- filtering by state transition;
- filtering by controller execution;
- folding repeated frames;
- exporting JSON diagnostics for tests.
