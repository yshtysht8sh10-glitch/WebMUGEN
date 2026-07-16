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

Power is durable player state. A loaded character starts each round at `power = 0`; `[Data] power` supplies `powerMax` (default 3000), not the initial gauge value. StateDef `poweradd`, PowerAdd/PowerSet, TargetPowerAdd, and explicit HitDef getpower/givepower all use the same 0..powerMax clamp. State transitions preserve both values, while round restart resets only the current value. Helper/root power ownership remains Partial until the Helper entity model is connected.

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

HitDef activation evaluates its major numeric expressions and pairs into a typed `ActiveHitDef` snapshot. Collision and later hit processing consume that snapshot instead of re-reading the originating controller after a hit. Parameters that are stored for later HitDef phases but not yet behaviorally connected are emitted in activation diagnostics and remain Partial.

The fallback hit recovery layer must not terminate an active common fall/down lifecycle. Grounded launch hits can enter States 5030/5035 with `HitFall=1` even when `targetStateTypeAtHit` was S/C; after hit-stun ends, those reactions continue through common States 5050, 5100/5110, 5120, and finally State 0. States 5200/5210 remain CNS-controlled and require both `CanRecover` and `Command = "recovery"`.

Issue #62 completes the common KO handoff. A lethal normal hit, guarded hit, or `HitFallDamage` records `koReason=hit`, `guard`, or `fall`, while independent `kill`, `guard.kill`, and `fall.kill` flags clamp their own nonlethal path at one Life. Hit pause finishes before State 5110 can route a defeated player into State 5150. Already-defeated players reject new HitDef collisions and are pruned from Target selection.

Lethal normal and guarded contact force the get-hit fall flag so the existing common 5000/5030/5100/5110 data reaches 5150. A guarded KO remains a guarded contact for effects and MoveGuarded, but uses the normal get-hit reaction instead of returning to guard idle with zero Life. No direct State 5150 jump is hard-coded.

State 5150 is the lying-dead state and never accepts recovery input. States 5200, 5201, and 5210 are fall-recovery states, not dead states. RoundState supplies `MatchOver`, winner/draw, and the distinct `ko`, `double_ko`, or `time_over` reason to the CNS context. See `common-ko-recovery-5150.md` for the state-by-state contract.

Issue #63 audits the entire accepted-HitDef-to-recovery/KO pipeline rather than treating each State family in isolation. The consolidated invariants, exact StateDef inventory, bundled T-H-M-A State 215 scenarios, and user confirmation boundary are recorded in `common-state-chain-audit.md`.

Issue #64 adds an explicitly non-compatibility Power Infinite runtime setting. Selected root players are normalized to their real `powerMax` at the game-frame boundary before CNS evaluation; ordinary Power controllers, StateDef `poweradd`, HitDef transfers, and later same-frame triggers still observe normal ordered mutations until the following frame. Modes, persistence, reset behavior, HUD marking, and the Helper phase boundary are documented in `infinite-power-settings.md`.

## Good next runtime improvements

- richer controller execution tables;
- cleaner trigger group diagnostics;
- previous-state tracking for `PrevStateNo` and related triggers;
- Helper and animation ownership beyond the implemented HitDef/TargetState/SelfState CNS owner ids;
- runtime events for HitDef/contact lifecycle.

## Explod creation runtime

`GameState.explods` is the durable match-level collection. `CnsStateRuntime` emits frame-local owner-scoped creation snapshots; the app coordinator allocates the internal runtime id and appends the entry before Runtime History capture. A MUGEN `id` is selection metadata and may be duplicated; it is never used as the internal identity.

Issues #30-#39 connect the baseline Explod collection, render, lifecycle, mutation, removal, and binding paths. Issue #34 additionally samples creation random through an injectable source, integrates non-bound world velocity before acceleration, applies scale and additive source alpha in Canvas, and removes `removeongethit` entries after owner hit resolution but before same-frame rendering. Issue #35 freezes the whole Explod tick during Pause/SuperPause and consumes the matching per-entry move-time allowance before an allowed tick. Default `bindtime=1` holds position for the creation tick and releases before later movement. Ownpal isolation, destination alpha/subtractive blend, shadow rendering, and non-player owners remain Partial.

Issue #36 converts each unprocessed HitEvent spark into a `hit-spark` entry after collision and before same-frame Canvas rendering. It reuses Explod AIR timing/removal/rendering but remains outside controller MUGEN-id selection, so `RemoveExplod id=0` cannot remove a contact effect accidentally. The same coordinator resolves the selected hit/guard sound sample and emits a channel-less SoundPlayEvent to the shared Browser Audio bridge. Runtime-integrated flags make a repeated coordinator call idempotent.

Issue #51 separates character/asset loading from live runtime startup. A prepared game-loop closure remains dormant behind the canvas Audio Start Gate until a direct pointer/key gesture makes the shared AudioContext report `running`, or the user explicitly chooses no-audio continuation after failure. BrowserInput and requestAnimationFrame are created only inside that once-only closure, so the first PlaySnd/HitDef sound cannot precede audio unlock on the normal audio-enabled path.

`GameState.pause` is the match-level Pause/SuperPause clock. The activation CNS pass emits one owner-scoped event; subsequent paused passes skip negative and current State controllers, and a one-frame resume guard lets physics advance StateTime before controllers can see the activation time again. The controller owner may continue for its `movetime`; other players, round time, hit resolution, and physics remain frozen. This ordering prevents Explod and sound side effects from being regenerated at the activation boundary. Same-pass events emitted by another player before the coordinator applies the pause remain a documented Partial boundary.
