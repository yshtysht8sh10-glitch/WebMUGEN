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

`PowerAdd` and `PowerSet` mutate the current player's durable Power through the shared 0..powerMax clamp. StateDef `poweradd`, TargetPowerAdd, and HitDef getpower/givepower use that same path so a character limit such as 9000 is not silently reduced to 3000. Each controller mutation emits a `raw.power` diagnostic. Helper ownership remains Partial.

`ChangeState` preserves the current State owner. `SelfState` resolves the player's `selfStateOwnerId`, enters that owner's CNS document, and clears borrowed ownership. In an ordinary StateDef, a successfully executed ChangeState or SelfState terminates that StateDef's remaining controller list; the entered State may then execute on the same frame. Negative common command states retain their existing entry-snapshot scan semantics. Helper/animation ownership remains Partial.

`AssertSpecial noautoturn` is a per-game-tick flag. `flag`, `flag2`, and `flag3` are checked case-insensitively; once asserted, the flag survives a later ChangeState in the same CNS pass and prevents the grounded stage rule from changing Facing. It is cleared at the beginning of the next CNS tick unless asserted again. Other AssertSpecial flags and WinMUGEN-version-specific hitpause persistence remain Partial.

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

### Variables

`VarSet` and `VarAdd` accept WinMUGEN `v`/`fv` parameters as well as the existing direct
`var(n)`/`fvar(n)`/`sysvar(n)`/`sysfvar(n)` compatibility syntax. VarRangeSet defaults to the full
selected family (Var 0..59 or FVar 0..39), and `fvalue` selects the float family. VarRandom supports
the default range, one-bound form, and inclusive two-bound form; its sample uses the same injectable
0..999 runtime random value as the Random trigger. Invalid indexes do not mutate state. The exact
Elecbyte PRNG sequence is not reproduced, so VarRandom remains Partial.

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

Issues #30-#39 connect Explod create/render/lifecycle and explicit-ID mutation/removal/binding. Issue #34 adds fixed creation random displacement, non-bound world velocity/acceleration, scale/Facing/vfacing transforms, additive source-alpha Canvas rendering, and remove-on-owner-hit. Issue #35 freezes the complete lifecycle tick during Pause/SuperPause unless the entry consumes `pausemovetime`/`supermovetime`; hitpause remains independent. Ownpal uses the existing owner asset scope but independent palette mutation is unverified; destination alpha, subtractive blending, and shadow pass remain Partial. See `explod-integration-design.md` for the remaining boundaries.

`Projectile` is connected to the production CNS/app path. Controller execution creates a Facing-relative runtime projectile, `velocity`/`accel` advance it, `projanim` renders from owner AIR, `projscale` affects rendering and collision, `projremovetime` expires it, and the initial AIR Clsn1 bounds drive contact/removal. Normal and `guardflag`-approved contacts update attacker `MoveHit`/`MoveGuarded`, apply explicit `getpower`/`givepower`, and select the matching spark/sound. A launched hit preserves the velocity, hit-time, fall, and `yaccel` snapshot required by common States 5030/5040. On a removing hit, `projhitanim` replaces the live projectile animation and disables further collision. HitDef `palfx.time/add/mul/sinadd/color/invertall` are snapshotted and normal hits apply a timed defender-only Canvas filter; this is the burning palette route used by bundled T-H-M-A State 1005. Exact per-channel palette arithmetic, animated Clsn changes, projectile interaction/priority, advanced `projremove`/`projhits`, guard/cancel animations, and pause parity remain Partial.

Projectile hit history also supplies `ProjHitTime(id)` to later CNS passes. During HitPause, the State runtime evaluates only Controllers whose `ignorehitpause` value is nonzero. This permits bundled T-H-M-A State -2 to create its four P2-bound fire Explods while the impact is frozen; `NumExplod(id)` reads committed entity-owned Explods and prevents recreation on the following paused frames.

An accepted non-guard Projectile hit now registers its live defender in the root owner's Target list with the Projectile ID and hit snapshot generation. This keeps the target available after Projectile removal and owner HitPause. Old-style `ProjHit<ID>` can therefore fire `TargetState` from the attacker's current or special State, enter the defender into the attacker's CNS document, continue through attacker-owned `ChangeState` transitions, and return through `SelfState`. Guard, miss, and KO/removed-target paths do not create a Target.

The common Target controllers now resolve the attacker's registered Target entries, optionally filtered by HitDef `id`, and mutate the matching player rather than assuming P1/P2 roles. `TargetVelSet`, `TargetVelAdd`, `TargetLifeAdd`, `TargetPowerAdd`, `TargetFacing`, `TargetState`, `TargetBind`, and `TargetDrop` are connected. A missing target is a diagnosed safe no-op, and `TargetDrop` prevents later Target controllers in the same State pass from finding the removed entry.

Issue #58 Phase1 connects `Helper` and `DestroySelf` to an independent runtime entity collection. Runtime entity IDs are unique and separate from duplicate-capable MUGEN Helper IDs. Each entry records root, parent, character/State/animation owner, requested State and Anim, and an independent PlayerState snapshot. Spawn requests commit after the current controller evaluation and begin normal State execution on the next frame, preventing recursive same-frame generation. Destroy requests commit before later physics/rendering. Round restart clears entries and resets the allocator. The later special-State Phase 1 restricts ordinary Helpers to their current State and permits State -1 only with `keyctrl = 1`; State -3/-2 remain root-only. Issue #81 connects active Helper HitDefs to the opposing root's Clsn2 and returns damage/reaction plus Helper-local HitPause, MoveHit, consumed-target, and Target state. Redirects, Bind/ParentVar, broader keyctrl details, Helper-as-defender/Helper-vs-Helper collision, palette mutation, and pause allowances remain incomplete; see `helper.md`.

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

`EnvShake` evaluates `time`, `freq`, `ampl`, and `phase` and starts the shared Canvas screen-shake feedback. Frequency defaults to 60, amplitude to -4, and phase to 0 (or 90 when frequency is at least 90), matching the WinMUGEN controller defaults. A zero time is an observable no-effect execution.

The shared browser adapter supports user-gesture AudioContext unlock, decode caching, master gain/mute, stop, live pan updates, cleanup, and safe diagnostics; see `audio.md`. `PlaySnd` emits firing-frame owner-scoped events and major playback parameters. `StopSnd` stops and releases the matching owner/channel voice. `SndPan` updates that current voice without touching another owner, a replaced voice, or channel-less voices. Omitted/invalid required values, exact WinMUGEN pan mapping, and advanced ownership remain Partial.

Issue #54 fixes the upstream trigger path used by repeating sounds. `AnimElem = N` now fires when the AIR element starts on every animation loop, so a PlaySnd controller can emit the same sample on later loops without a dash-specific timer or sample/state hack. The controller runtime still evaluates every frame; the event bridge and Browser Audio runtime permit the same sample on distinct frames.

Issue #51 makes the first gesture atomic from unlock request through the following sound bridge: one pending `resume()` is shared, and PlaySnd or HitDef sound emitted before it resolves waits for that attempt. There is no unbounded pre-gesture queue, failed resume remains retryable, and Runtime tab changes do not recreate or subscribe the adapter.

Issue #81 connects `AfterImage` to player frame-history capture and Canvas rendering. `time`, `length`, `timegap`, `framegap`, and `trans` follow the documented history semantics; `AfterImageTime` changes an active effect and zero clears it. The palette fields are retained and approximated with Canvas filters, while `add`/`add1` use additive composition. Exact indexed-palette arithmetic, subtractive blending, and pause behavior outside the root-player path remain Partial. `raw.afterimage_draw` reports captured/displayed/drawn counts and the active gaps.

Issue #81 connects `BGPalFX` as a match-level, background-only effect. `time`, `color`, `invertall`, `add`, `mul`, and `sinadd` are evaluated when the controller fires; the app retains the duration and the renderer applies the resulting filter only around the stage pass. `raw.bgpalfx_draw` reports the owner, remaining time, source values, and Canvas approximation. Exact per-channel palette arithmetic and activation during hitpause remain Partial.

`Pause` and `SuperPause` now emit match-level events instead of storing dead player fields. The owner may execute and move for `movetime`; other CNS and physics stop, including negative States. Explods use their own matching allowance. PlaySnd on the activation pass fires once, then controller suppression plus the resume guard prevents replay. Existing browser voices continue through the pause. A SuperPause with `darken = 1` draws a half-opacity black screen pass after regular layers and before hit feedback/`ontop` Explods; normal Pause and `darken = 0` do not. Same activation-pass cross-player ordering, Helper ownership, default SuperPause anim/sound/pos, and other presentation details remain Partial.

If the controller only stores a field or is skipped safely, mark Partial.

## Complete vs Partial

`Null` can be Complete because explicit no-op is the intended behavior.

`AfterImage` remains Partial because frame history and visible composition are connected, but Canvas filters do not exactly reproduce WinMUGEN's indexed-palette arithmetic.

`HitDef` is Partial. When the controller activates, the live CNS runtime evaluates and freezes a typed `ActiveHitDef` snapshot containing attr, damage, ground/air/fall animation types, hit/guard flags, priority, hit/guard pause, ground/air/guard types, hit times, velocities, major fall fields, id/chain fields, `hitonce`, kill/power/numhits, five cornerpush variants, snap, and P1/P2 sprite priorities. Numeric CNS expressions and parameter pairs are evaluated with the activation-frame player/opponent context. Parameter punctuation and whitespace follow WinMUGEN's ASCII syntax: a Shift-JIS full-width comma is retained inside the value and a full-width trailing space remains part of an enum token. Thus T-H-M-A State 232 neither applies the text after its full-width comma as Y launch velocity nor accepts `back　` as `animtype = back`; it falls back to the grounded Light/High reaction instead of holding the one-frame Anim 5030 throughout HitPause. Every successful controller execution creates a new ActiveHitDef generation, including repeated AnimElem activations from the same controller. Generation activation preserves the prior MoveContact/MoveHit/MoveGuarded result; the next accepted hit or guard replaces it, while State-local HitCount is retained. Stored fields whose combat behavior is not connected are reported as `stored_not_applied`; failed evaluations retain their parameter names in diagnostics.

`PosFreeze` is a boolean controller, not a duration field. A nonzero value (default 1) suppresses position and velocity integration for the controller execution frame while StateTime and AnimTime continue. This is the behavior used by common airborne recovery State 5210; its literal `value = 4` is truthy and does not mean four frozen ticks.

`FallEnvShake` reads the `fall.envshake.time/freq/ampl/phase` values snapshotted from the HitDef that caused the fall and starts the shared Canvas screen-shake feedback when the configured time is positive. Common States 5100 and 5110 therefore retain their data-defined landing effect; zero time is an explicit no-effect execution rather than a fabricated default shake.

Before damage or guard resolution, `hitflag` classifies the target as standing, crouching, air, falling/get-hit, or down and checks H/L/M/A/F/D respectively. The legacy `P` suffix found in WinMUGEN character data is accepted without changing those target classes; bundled T-H-M-A States 410 and 610 exercise `MAFP`. A `+` suffix requires the target already to have `MoveType = H`, while `-` excludes that hit state; T-H-M-A State 700 uses `M-` for its throw. The same normalized `attr` snapshot drives `HitDefAttr` and defender `HitBy`/`NotHitBy` filters. Unknown hitflag characters reject with explicit diagnostics rather than becoming unconditional hits.

When both players have eligible Clsn contact in the same frame, priority is resolved from the original frame snapshot rather than P1-first mutation order. Higher numeric priority wins; equal `Hit` trades; equal `Miss` or `Dodge` produces no contact. Mixed priority-type edge cases remain Partial and are diagnosed.

Accepted contact emits one effect envelope per ActiveHitDef/target generation. Normal contact uses `sparkno`/`hitsound`; guard uses `guard.sparkno` (and legacy `guardsparkno`)/`guardsound`. Issue #49 follows WinMUGEN `sparkxy` coordinates: X starts at P2's P1-facing `Size` edge (`ground.front/back` or `air.front/back`), while Y starts at P1's axis; negative Y moves upward. The resolved point is explicitly stage-space, so owner/root position is not reapplied when Issue #36 converts valid sparks into isolated `hit-spark` entries in the shared Explod lifecycle. AIR element and SFF axis offsets are each applied once by the normal Explod sprite draw. Scoped expressions are evaluated on activation (`S` means attacker character, `F`/unprefixed means common), and valid sounds use the same SoundPlayEvent/Browser Audio bridge as PlaySnd. The effect is generated once per HitEvent; a processed event is idempotent and the spark is not selectable by Modify/RemoveExplod MUGEN id. Missing AIR actions, SND samples, or common archives are diagnosed safe no-ops. The bundled app has no common fightfx AIR/SFF/SND, so common-scope visual/audio remains Partial. `envshake.time/freq/ampl/phase` continues driving the feedback screen offset.

The currently connected subset requires an ActiveHitDef and AIR Clsn overlap, then applies damage and selects ground/air hit time, animation type, and velocity from the defender StateType at contact. Standing contact enters State 5000, crouching contact enters State 5010, and air contact enters State 5020. S/C contacts select `ground.velocity`; A selects `air.velocity`; `fall.yvelocity` remains a separate GetHitVar value. Ground Light/Medium/Hard maps to required Anim 5000/5001/5002. Hit velocity X is converted once so the common negative value moves away from the attacker for either Facing; Y is applied directly. `HitVelSet` restores selected components after the common shake state, and `HitFallVel` restores the fall velocity for bounce. Hit pause preserves the applied velocity, and physics moves the defender after pause ends. Missing ActiveHitDef or Clsn boxes reject the hit. Less common animation types and broader combat semantics remain incomplete.

HitDef velocity components use the runtime numeric-expression evaluator, including redirected
conditions inside `IfElse`. T-H-M-A State 233's third hit evaluates
`-15 + 9 * IfElse(enemy, GetHitVar(hitcount) >= 7, 1, 0)` to `-15` below seven hits and `-6` at
seven or more, instead of discarding the expression and using the fallback air Y velocity.

StateDef `velset` and HitDef velocity are separate: entering common shake State 5000 clears live `vx`/`vy`, but the saved `hitVelX`/`hitVelY` and GetHitVar snapshot remain available for StateTypeSet routing and the later component-selective `HitVelSet`.

Guard contact snapshots Facing-relative `holdback`/`holddown` intent before collision. Within `guard.dist`, H/M permits standing guard, L/M crouching guard, and A air guard. Accepted guard uses `guard.damage`, `guard.pausetime`, `guard.hittime`, `guard.ctrltime`, and `guard.velocity`, enters common State 150/152/154, sets MoveContact/MoveGuarded without MoveHit, and follows the unmodified recoil/guard-end states. `guard.kill = 0` clamps chip damage at one Life; normal hit damage and KO behavior remain independent. Control cannot be enabled before guard control time. Missing input, a mismatched guardflag, or excessive distance falls through to the normal hit path.

Normal `kill`, guarded `guard.kill`, and common-State fall damage `fall.kill` are independent. A disabled kill flag clamps its applicable damage at one Life. HitDef fall damage and kill are stored in GetHitVar and consumed by the existing `HitFallDamage` controllers, rather than modifying `common1.cns`.

Lying targets use the HitDef `down.velocity`, `down.hittime`, and `down.bounce` branch and enter common State 5080. `down.hittime` is slide/hit-stun time for a zero-Y lying hit; it is not a get-up timer. Omitted down velocity inherits air velocity. `HitFallSet` now mutates fall/value/xvel/yvel, and `HitBy`/`NotHitBy` use two independently timed WinMUGEN attribute slots, including the state-only and attack-only forms used by common State 5120.

Explicit `getpower` and `givepower` hit/guard pairs apply once per accepted contact and clamp each gauge to that player's `powerMax`. Omitted values still lack the `mugen.cfg` multiplier defaults and are documented Partial. `numhits` adds to the defender combo/GetHitVar(hitcount), while attacker HitCount remains one per successful target contact.

The matching ground/air/down/guard/airguard cornerpush value changes attacker X velocity only when the contacted target is at the existing fallback stage boundary; the value is converted by attacker Facing once. `snap` places the target at attacker position plus Facing-relative X and absolute Y offsets. `p1sprpriority` and `p2sprpriority` update the two runtime sprite priority fields on hit or guard; Canvas draws lower priority first and higher priority later. Camera-relative boundaries and projectile/effect layering remain Partial.

Successful contacts are recorded by ActiveHitDef generation, defender id, and HitDef `id`. Continued overlap with the same generation/defender pair cannot apply damage, HitEvent, or hit stun again; a new HitDef generation can hit again even when it uses the same `id`. The defender remembers the last successful `id` and attacker: `chainid` requires that pair, `nochainid` rejects it, and a later third-party hit invalidates both constraints for the original attacker. `hitonce = 1` prevents a generation that already hit one target from affecting a different target; normal attacks default to 0 and throw attributes default to 1. Full team-mode target selection remains Partial.

For an airborne target, accepted contact also checks the attack StateDef `juggle` cost against the defender's remaining `[Data] airjuggle` pool (default 15 when omitted). The first accepted air contact in an attack chain consumes the cost for that target; later HitDef generations and continued attack States do not pay it again. Entering an attack StateDef with an explicit `juggle` value begins a new chain, while an omitted value in a directly continued attack State inherits the preceding payment as required for multi-State attacks. Ordinary grounded hits do not use this check. Air/down states retain the defender pool and grounded controllable recovery resets it. Helper/projectile/team chains remain Partial.

Attacker move-result state separately tracks contact, hit, guarded, and State-local hit count for MoveContact/MoveHit/MoveGuarded/HitCount. New HitDef generations reset result flags but retain count. On State entry, `hitdefpersist` independently preserves the ActiveHitDef and its consumed-target history, `movehitpersist` preserves result flags, and `hitcountpersist` preserves the count; omitted/zero flags discard their respective data. `MoveHitReset` clears only result flags, preserving duplicate-hit history and count.

Issue #66 verifies lifecycle ordering with the bundled T-H-M-A 3405/3415 data. Action 3405 reaches its AIR-derived end before the data-defined ChangeState enters 3415; the destination's HitDef activates from AnimElem and remains available while State 3415 is held until its `Time = 10` terminal route. A redirect lookup failure cannot substitute self and spuriously satisfy a controller. `raw.trigger`, `raw.controller_transition`, and `raw.hitdef_lifecycle` together identify the exact source controller and any later `reason=state_change` discard.

Successful non-KO contact also registers a Target entry with player id, HitDef id, and ActiveHitDef generation. Entries persist independently of State transitions, support multiple targets, and are removed for KO/destroyed players or round restart. Connected Target controllers select these entries by optional HitDef `id` and apply changes to the registered player.

HitDef `pausetime` is applied as separate attacker/defender counters. Positive counters skip CNS controller execution and freeze physics/timers while input buffering continues; zero resumes without an extra frame. Guarded contact uses `guard.pausetime` when present. This hit pause is independent of the Partial SuperPause controller.

During the selected hit time, the runtime keeps `ctrl = false`, blocks control-enabling `CtrlSet`, blocks early recovery to State 0/52, and ignores State -1 input ChangeState routes. Internal common get-hit transitions such as State 5000 to 5001 remain available. Hit-stun elapsed time is stored independently from `stateTime` so internal get-hit State changes do not shorten the configured duration. When that time expires in a borrowed `TargetState`, fallback recovery retires the hit-stun timer without forcing State 0; the attacker's CustomState remains responsible for `ChangeState` and the eventual `SelfState` return.

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
