# CNS Runtime

Updated: 2026-07-06

This document describes the CNS runtime layer. For the full frame flow, see `runtime-pipeline.md`.

## Responsibility

The CNS runtime executes parsed CNS data. It should not contain hidden KFM-specific rules.

Its responsibilities are:

- locate StateDefs;
- execute negative states in order;
- evaluate controller triggers;
- execute State Controllers;
- apply centralized state entry;
- record traces for Debug Overlay and Runtime History.

## Runtime order

For each player, the current order is:

```text
State -3
  ↓
State -2
  ↓
State -1
  ↓
current StateDef
```

This mirrors MUGEN-style global and command state processing closely enough for current compatibility work.

If a negative state changes `stateNo`, the runtime exits early for that player after recording the transition. This prevents old-state logic from running after State -1 has already changed state.

## Controller loop

For each controller:

1. build trigger context;
2. evaluate trigger records;
3. if false, skip the controller;
4. if true, execute the controller;
5. record before/after state when debugging;
6. append the controller name when it actually executes.

A controller with a false trigger is not an executed controller.

## Trigger context

The trigger context typically includes:

- current player state;
- opponent / related player state when available;
- active command set;
- animation timing helpers;
- runtime constants and safe defaults;
- optional callback hooks such as animation existence lookup.

Missing subsystem context should produce conservative Partial behavior, not fake Complete compatibility.

## State entry

State entry centralization is important. It prevents each controller from reimplementing inconsistent rules.

State entry should handle:

- state number;
- state time reset;
- initial animation;
- StateDef header fields;
- entry-only effects such as `poweradd`;
- facing changes such as `facep2`.

If a field is applied on every frame instead of on state entry, compatibility bugs become subtle and hard to diagnose.

## Debug trace

A runtime trace should answer:

- what state the player started in;
- what state the player ended in;
- what animation changed;
- which controllers executed;
- whether a StateDef was found;
- why important routes did or did not run.

For movement bugs, a useful trace includes:

```text
S-1 ChangeState v=20 OK/NG
triggerall command="holdfwd"
group1 statetype=S, stateno!=20
shouldRun=T/F
pipe before state=0
pipe after state=20
```

## Compatibility cautions

Do not hard-code state numbers unless the behavior is truly an engine-level common rule and cannot be expressed as MUGEN data.

When a route can be represented in `common.cmd`, prefer `common.cmd`.

When a behavior depends on a future subsystem, implement the safest observable partial behavior and keep the matrix status Partial.

## Good next runtime improvements

- richer controller execution tables;
- cleaner trigger group diagnostics;
- previous-state tracking for `PrevStateNo` and related triggers;
- better ownership semantics for `SelfState`, target states, and helpers;
- runtime events for HitDef/contact lifecycle.
