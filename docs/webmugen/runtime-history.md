# Runtime History

Updated: 2026-07-06

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

## Signature / deduplication

A history signature can prevent identical repeated entries.

The signature should be based on the snapshot text, not mutable data references.

If a line changes every frame due only to time counters, decide whether that is useful. During movement debugging, state time can be useful. During idle debugging, it may create noise.

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
