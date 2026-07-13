# State Controller Executor

Updated: 2026-07-09

This document describes how State Controllers are executed. For per-controller status, see `state-controller-compatibility-notes.md` and the compatibility matrix.

## Responsibility

The controller executor applies a State Controller after its triggers have passed.

It should:

- read parsed controller type and parameters;
- mutate `PlayerState` only according to the controller semantics;
- report whether it executed;
- preserve compatibility data needed by later subsystems;
- remain generic, not KFM-specific.

## Execution flow

```text
controller candidate
  ↓
trigger records evaluated
  ↓
if false: skip
  ↓
if true: execute controller type
  ↓
return next PlayerState + executed flag + controller name
```

The runtime trace should distinguish:

- controller was present;
- controller trigger passed;
- controller executed;
- controller changed state/velocity/animation/etc.

## Controller categories

### Basic state mutation

Examples:

- `ChangeState`
- `SelfState`
- `CtrlSet`
- `StateTypeSet`
- `MoveTypeSet`

These mutate state identity or state flags.

`ChangeState` preserves the current State owner. `SelfState` resolves the player's `selfStateOwnerId`, enters that owner's CNS document, and clears borrowed ownership. Helper/animation ownership remains Partial.

### Motion and position

Examples:

- `VelSet`
- `VelAdd`
- `VelMul`
- `PosSet`
- `PosAdd`

`PlayerState.vx` is stored in world coordinates and position integration adds it directly to world X. `VelSet` and `VelAdd` therefore multiply CNS X values by the player's current facing once when the controller executes. `VelMul` scales the already converted world velocity and must not apply facing again. If parameters are expressions, parser/evaluator support must be verified before marking broad compatibility.

### Animation

Examples:

- `ChangeAnim`
- `ChangeAnim2`

`ChangeAnim` is runtime animation selection. Its `value` parameter is evaluated through the CNS numeric expression evaluator, so expressions such as `ifelse((vel x)=0,44,45)+var(5)*4` can use the current player velocity and variables. `ChangeAnim2` depends on target/common animation ownership and remains Partial if only recognized.

### Hit and attack state

Examples:

- `HitDef`
- `HitBy`
- `NotHitBy`
- `HitVelSet`
- `HitFallVel`
- `HitFallDamage`
- `MoveHitReset`

These are high-risk compatibility areas. Parser support or field storage does not mean complete WinMUGEN behavior.

Keep matrix status Partial until contact lifecycle, target creation, guard, hit pause, get-hit states, and persistence are verified.

### Target / Helper / Projectile / Explod

Examples:

- `TargetState`
- `TargetVelSet`
- `Helper`
- `Projectile`
- `Explod`

Issue #30 connects `Explod` creation through the normal expression-aware CNS executor into an owner-scoped `GameState.explods` collection. Internal runtime ids are independent from duplicate MUGEN ids. Creation freezes anim/source, postype and resolved initial coordinates, Facing, bind/removetime metadata, draw order, and later movement/render fields; missing or invalid anim is a diagnosed rejection. Round creation/restart clears the collection. Canvas rendering, animation/removetime/bind stepping, Modify/Remove/Bind controllers, Helper ownership, and exact camera/random semantics remain Partial per `explod-integration-design.md`.

The common Target controllers now resolve the attacker's registered Target entries, optionally filtered by HitDef `id`, and mutate the matching player rather than assuming P1/P2 roles. `TargetVelSet`, `TargetVelAdd`, `TargetLifeAdd`, `TargetPowerAdd`, `TargetFacing`, `TargetState`, `TargetBind`, and `TargetDrop` are connected. A missing target is a diagnosed safe no-op, and `TargetDrop` prevents later Target controllers in the same State pass from finding the removed entry.

`TargetState` assigns the controller owner's stable player id as the target's State owner and resolves that owner's CNS document. This matches HitDef `p2stateno` with `p2getp1state = 1`; `SelfState` returns the target to its own document. Animation ownership, Helpers, and multi-player targets remain Partial. `TargetBind` applies its position immediately and records duration/offset metadata; following-frame bind maintenance is not yet connected.

HitDef `p1stateno` enters an attacker-owned State. `p2stateno` enters a target-owned State by default; only explicit `p2getp1state = 1` borrows the attacker document. `forcestand` changes the target StateType without changing ownership. Missing owner documents or State numbers remain safe and produce `raw.custom_state` diagnostics instead of falling back to a different character's CNS.

### Visual/audio effects

Examples:

- `AfterImage`
- `PalFX`
- `EnvShake`
- `PlaySnd`
- `Trans`
- `AngleDraw`

CharacterLoader exposes parsed SND v1 samples by group/index without depending on browser audio. PlaySnd, StopSnd, and SndPan are now connected to the shared browser runtime for character-owned channels.

The shared browser adapter supports user-gesture AudioContext unlock, decode caching, master gain/mute, stop, live pan updates, cleanup, and safe diagnostics; see `audio.md`. `PlaySnd` emits firing-frame owner-scoped events and major playback parameters. `StopSnd` stops and releases the matching owner/channel voice. `SndPan` updates that current voice without touching another owner, a replaced voice, or channel-less voices. Omitted/invalid required values, exact WinMUGEN pan mapping, and advanced ownership remain Partial.

If the controller only stores a field or is skipped safely, mark Partial.

## Complete vs Partial

`Null` can be Complete because explicit no-op is the intended behavior.

`AfterImage` as safe no-op is Partial because the visual effect is missing.

`HitDef` is Partial. When the controller activates, the live CNS runtime evaluates and freezes a typed `ActiveHitDef` snapshot containing attr, damage, ground/air/fall animation types, hit/guard flags, priority, hit/guard pause, ground/air/guard types, hit times, velocities, major fall fields, id/chain fields, `hitonce`, kill/power/numhits, five cornerpush variants, snap, and P1/P2 sprite priorities. Numeric CNS expressions and parameter pairs are evaluated with the activation-frame player/opponent context. After that hit is consumed, re-execution of the same controller does not replace the snapshot. Stored fields whose combat behavior is not connected are reported as `stored_not_applied`; failed evaluations retain their parameter names in diagnostics.

Before damage or guard resolution, `hitflag` classifies the target as standing, crouching, air, falling/get-hit, or down and checks H/L/M/A/F/D respectively. The same normalized `attr` snapshot drives `HitDefAttr` and defender `HitBy`/`NotHitBy` filters. Malformed attr, unknown hitflag characters, and currently unsupported `+`/`-` modifiers reject with explicit diagnostics rather than becoming unconditional hits.

When both players have eligible Clsn contact in the same frame, priority is resolved from the original frame snapshot rather than P1-first mutation order. Higher numeric priority wins; equal `Hit` trades; equal `Miss` or `Dodge` produces no contact. Mixed priority-type edge cases remain Partial and are diagnosed.

Accepted contact emits one effect envelope per ActiveHitDef/target generation. Normal contact uses `sparkno`/`hitsound`; guard uses `guard.sparkno` (and legacy `guardsparkno`)/`guardsound`. `sparkxy` is added to the Clsn intersection center with X converted by attacker Facing. Attacker-scoped `S` spark actions are checked against AIR and missing actions are skipped safely; common fightfx availability remains unknown. Sound cues retain common/attacker scope and sample ids, but SND decoding/playback is still Partial. `envshake.time/freq/ampl/phase` drives the feedback screen offset.

The currently connected subset requires an ActiveHitDef and AIR Clsn overlap, then applies damage and selects ground/air hit time, animation type, and velocity from the defender StateType at contact. Ground Light/Medium/Hard maps to required Anim 5000/5001/5002; air contact enters State 5020 and lets the unmodified common states consume the snapshotted air/fall data. Hit velocity X is converted once so the common negative value moves away from the attacker for either Facing; Y is applied directly. `HitVelSet` restores selected components after the common shake state, and `HitFallVel` restores the fall velocity for bounce. Hit pause preserves the applied velocity, and physics moves the defender after pause ends. Missing ActiveHitDef or Clsn boxes reject the hit. Less common animation types and broader combat semantics remain incomplete.

StateDef `velset` and HitDef velocity are separate: entering common shake State 5000 clears live `vx`/`vy`, but the saved `hitVelX`/`hitVelY` and GetHitVar snapshot remain available for StateTypeSet routing and the later component-selective `HitVelSet`.

Guard contact snapshots Facing-relative `holdback`/`holddown` intent before collision. Within `guard.dist`, H/M permits standing guard, L/M crouching guard, and A air guard. Accepted guard uses `guard.damage`, `guard.pausetime`, `guard.hittime`, `guard.ctrltime`, and `guard.velocity`, enters common State 150/152/154, sets MoveContact/MoveGuarded without MoveHit, and follows the unmodified recoil/guard-end states. `guard.kill = 0` clamps chip damage at one Life; normal hit damage and KO behavior remain independent. Control cannot be enabled before guard control time. Missing input, a mismatched guardflag, or excessive distance falls through to the normal hit path.

Normal `kill`, guarded `guard.kill`, and common-State fall damage `fall.kill` are independent. A disabled kill flag clamps its applicable damage at one Life. HitDef fall damage and kill are stored in GetHitVar and consumed by the existing `HitFallDamage` controllers, rather than modifying `common1.cns`.

Explicit `getpower` and `givepower` hit/guard pairs apply once per accepted contact and clamp both gauges to 0..3000. Omitted values still lack the `mugen.cfg` multiplier defaults and are documented Partial. `numhits` adds to the defender combo/GetHitVar(hitcount), while attacker HitCount remains one per successful target contact.

The matching ground/air/down/guard/airguard cornerpush value changes attacker X velocity only when the contacted target is at the existing fallback stage boundary; the value is converted by attacker Facing once. `snap` places the target at attacker position plus Facing-relative X and absolute Y offsets. `p1sprpriority` and `p2sprpriority` update the two runtime sprite priority fields on hit or guard; Canvas draws lower priority first and higher priority later. Camera-relative boundaries and projectile/effect layering remain Partial.

Successful contacts are recorded by ActiveHitDef generation, defender id, and HitDef `id`. Continued overlap with the same generation/defender pair cannot apply damage, HitEvent, or hit stun again; a new HitDef generation can hit again even when it uses the same `id`. The defender remembers the last successful `id` and attacker: `chainid` requires that pair, `nochainid` rejects it, and a later third-party hit invalidates both constraints for the original attacker. `hitonce = 1` prevents a generation that already hit one target from affecting a different target; normal attacks default to 0 and throw attributes default to 1. Full team-mode target selection remains Partial.

For an airborne target, accepted contact also checks the attack StateDef `juggle` cost against the defender's remaining `[Data] airjuggle` pool (default 15 when omitted). A successful ActiveHitDef generation consumes the cost once; continued overlap does not consume again, while a new generation is rejected when the remaining pool is insufficient. Ordinary grounded hits do not use this check. Air/down states retain the pool and grounded controllable recovery resets it.

Attacker move-result state separately tracks contact, hit, guarded, and State-local hit count for MoveContact/MoveHit/MoveGuarded/HitCount. New HitDef generations reset result flags but retain count. On State entry, `hitdefpersist` independently preserves the ActiveHitDef and its consumed-target history, `movehitpersist` preserves result flags, and `hitcountpersist` preserves the count; omitted/zero flags discard their respective data. `MoveHitReset` clears only result flags, preserving duplicate-hit history and count.

Successful non-KO contact also registers a Target entry with player id, HitDef id, and ActiveHitDef generation. Entries persist independently of State transitions, support multiple targets, and are removed for KO/destroyed players or round restart. Connected Target controllers select these entries by optional HitDef `id` and apply changes to the registered player.

HitDef `pausetime` is applied as separate attacker/defender counters. Positive counters skip CNS controller execution and freeze physics/timers while input buffering continues; zero resumes without an extra frame. Guarded contact uses `guard.pausetime` when present. This hit pause is independent of the Partial SuperPause controller.

During the selected hit time, the runtime keeps `ctrl = false`, blocks control-enabling `CtrlSet`, blocks early recovery to State 0/52, and ignores State -1 input ChangeState routes. Internal common get-hit transitions such as State 5000 to 5001 remain available. Hit-stun elapsed time is stored independently from `stateTime` so internal get-hit State changes do not shorten the configured duration.

StateDef headers and allowed internal ChangeState controllers are also forced back to `ctrl = false` immediately when hit stun is active, preventing a one-controller-frame control leak. Diagnostics distinguish blocked controllers from this post-transition/header force. Full common1 `GetHitVar`-driven branching is tracked separately under GetHitVar compatibility.

## Debugging controller issues

When a controller appears not to work:

1. confirm the StateDef contains the controller;
2. confirm triggers pass;
3. confirm executor reaches the controller type branch;
4. confirm parameters parse correctly;
5. confirm before/after PlayerState changed as expected;
6. confirm physics/animation/rendering did not overwrite the effect.

## Test guidance

Controller tests should include:

- trigger false case;
- trigger true case;
- expected state mutation;
- parameter parse edge cases;
- matrix status update only for the exact behavior tested.

Do not use broad tests to mark unrelated controller features Complete.
