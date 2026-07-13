# WebMUGEN WinMUGEN Compatibility Matrix

Updated: 2026-07-13

This document is the working compatibility checklist for WebMUGEN. Every compatibility item is tracked on its own row. Do not combine multiple triggers, controllers, states, operators, redirects, or CMD features into a single matrix item.

Status is intentionally conservative: **Complete** requires either focused tests or a confirmed app integration path. Runtime shims that only recognize an item or preserve safe no-op behavior are marked **Partial**, not Complete.

Baseline references:

- Elecbyte MUGEN CNS trigger reference: https://www.elecbyte.com/mugendocs-11b1/trigger.html
- Elecbyte MUGEN state controller reference: https://www.elecbyte.com/mugendocs-11b1/sctrls.html
- Elecbyte MUGEN CNS format reference: https://www.elecbyte.com/mugendocs-11b1/cns.html
- Elecbyte MUGEN common states reference: https://www.elecbyte.com/mugendocs-11b1/common1.html
- WinMUGEN-era behavior should be checked against actual WinMUGEN where 1.0/1.1 docs differ.

## Status Legend

| Status | Meaning |
|---|---|
| Complete | Implemented and covered by tests or known runtime usage. |
| Partial | Implemented for simple cases, implemented as a safe default, or recognized as a compatibility shim without full WinMUGEN behavior. |
| Unsupported | Not implemented and no compatibility shim exists. |
| Untested | Needs verification against WinMUGEN or existing code before marking. |

## Testing Rule

State transitions must be validated by focused UnitTests whenever possible. Manual game-screen checks are useful, but they are not sufficient by themselves.

A movement or command route test should assert the actual runtime result, especially `stateNo`, `animNo`, `stateType`, `physics`, `ctrl`, velocity, and facing when relevant. On failure, the test should print frame-by-frame diagnostics containing input, state before stepping, and state after stepping. This lets a pasted test log narrow the failure to input handling, command resolution, trigger evaluation, ChangeState execution, state header application, physics, animation, or rendering integration.

The detailed policy lives in `docs/webmugen/testing-policy.md`.

## StateDef Compatibility

| StateNo | WinMUGEN Meaning | Status | Notes |
|---:|---|---|---|
| -3 | Global state | Complete | `stepCnsStateRuntime` executes -3 before -2/-1 with focused ordering coverage. |
| -2 | Global state | Complete | `stepCnsStateRuntime` executes -2 after -3 and before -1 with focused ordering coverage. |
| -1 | Command state | Complete | Used for CMD routing and covered by focused ChangeState/ordering tests. |
| 0 | Stand | Complete | Common baseline and idle fallback exist. Fallback route has diagnostic regression coverage. |
| 10 | Crouch start | Complete | Common route integration is covered by runtime assertions for state, anim, type, physics, and ctrl. |
| 11 | Crouching | Complete | Common crouch-hold route from State 10 is covered by CNS runtime assertions. |
| 12 | Crouch end | Complete | Common crouch-release route from State 11 is covered by CNS runtime assertions. |
| 20 | Walk forward | Complete | Common holdfwd route is covered by CNS runtime ChangeState assertions. Walk route is blocked during dash states 100-107. |
| 21 | Walk back | Complete | Common holdback route is covered by CNS runtime ChangeState assertions. Walk route is blocked during dash states 100-107. |
| 40 | Jump start | Complete | Common holdup route into State 40 is covered by CNS command/runtime tests. |
| 41 | Character-defined jump variant | Complete | Character-defined holdup override into State 41 is covered by CNS runtime assertions. |
| 42 | Character-defined jump variant | Complete | Character-defined holdup route into State 42 is covered by CNS runtime assertions. |
| 45 | Air jump / jump transition variant | Partial | Character-defined State 45 entry is covered; common air-jump rules still need WinMUGEN/common1 verification. |
| 50 | Jump up | Partial | Common baseline exists. Air physics incomplete. |
| 51 | Jump down | Partial | Character-defined State 51 entry is covered; full common air-state sequencing is still incomplete. |
| 52 | Jump land | Partial | Common baseline exists. Landing logic under active work. |
| 100 | Run / dash forward | Partial | Common route added with PosAdd. Common walk routes no longer interrupt dash states 100-107. Needs true velocity/friction behavior. |
| 101 | Run / dash substate | Untested | Common walk routes no longer interrupt dash states 100-107. Common implementations vary. |
| 102 | Run / dash substate | Untested | Common implementations vary. |
| 103 | Run / dash substate | Untested | Common implementations vary. |
| 104 | Run / dash substate | Untested | Common implementations vary. |
| 105 | Hop back / back dash | Partial | Common route added with PosAdd. Common walk routes no longer interrupt dash states 100-107. |
| 106 | Back dash substate | Untested | Common implementations vary. |
| 107 | Back dash substate | Untested | Common implementations vary. |
| 120 | Guard start | Partial | Common guard-start controllers execute; proactive pre-contact routing remains incomplete. |
| 130 | Standing guard | Partial | Standing GuardHit returns to the unmodified common standing guard while holdback and guard distance remain valid. |
| 131 | Crouching guard | Partial | Crouch guard and common high/low transitions execute; broader command timing remains incomplete. |
| 132 | Air guard | Partial | Air guardflag contact enters the common air GuardHit path; full landing variants remain incomplete. |
| 140 | Guard end | Partial | Common U-type guard-end state preserves StateType/physics and releases guard. |
| 150 | Standing GuardHit shake | Partial | H/M-guarded standing contact enters this common state with guard pause/hit time snapshot. |
| 151 | Standing GuardHit recoil | Partial | Common HitVelSet/HitOver path is integration-tested. |
| 152 | Crouching GuardHit shake | Partial | L/M-guarded crouch contact enters this common state. |
| 153 | Crouching GuardHit recoil | Partial | Common crouch recoil path is connected; advanced timing remains incomplete. |
| 154 | Air GuardHit shake | Partial | A-guarded air contact enters this common state. |
| 155 | Air GuardHit recoil | Partial | Common air recoil path receives guard velocity; full landing behavior remains incomplete. |
| 170 | Lose state | Unsupported | Round flow only partially implemented. |
| 171 | Lose state | Unsupported | Round flow only partially implemented. |
| 172 | Lose state | Unsupported | Round flow only partially implemented. |
| 173 | Lose state | Unsupported | Round flow only partially implemented. |
| 180 | Win state | Unsupported | Round flow only partially implemented. |
| 181 | Win state | Unsupported | Round flow only partially implemented. |
| 190 | Intro state | Unsupported | Round intro not implemented. |
| 191 | Intro state | Unsupported | Round intro not implemented. |
| 192 | Intro state | Unsupported | Round intro not implemented. |
| 193 | Intro state | Unsupported | Round intro not implemented. |
| 194 | Intro state | Unsupported | Round intro not implemented. |
| 195 | Intro state | Unsupported | Round intro not implemented. |
| 196 | Intro state | Unsupported | Round intro not implemented. |
| 197 | Intro state | Unsupported | Round intro not implemented. |
| 198 | Intro state | Unsupported | Round intro not implemented. |
| 199 | Intro state | Unsupported | Round intro not implemented. |
| 5000 | Common get-hit state | Partial | Standing hit enters State 5000 with persistent GetHitVar snapshot, required Anim selection, independent hit-stun clock, and guarded internal transitions. Air/crouch/fall/guard branches remain incomplete. |
| 5001 | Common get-hit state | Unsupported | Required for hit reactions. |
| 5010 | Common get-hit state | Unsupported | Required for hit reactions. |
| 5011 | Common get-hit state | Unsupported | Required for hit reactions. |
| 5020 | Common get-hit state | Partial | Air contact enters the unmodified common state with air animtype/hittime/velocity snapshot data. Guard and uncommon animation branches remain incomplete. |
| 5030 | Fall state | Partial | Common air hit velocity/gravity and HitFall routing are covered by runtime integration tests. |
| 5035 | Fall state | Partial | Common transition participates in tested air-hit recovery/fall paths; animation completeness varies by character. |
| 5040 | Fall state | Partial | Non-fall air recovery and landing are connected; full KO and animation behavior remains incomplete. |
| 5050 | Fall state | Partial | Fall/recover/recovertime routes and landing detection are connected; recovery state details remain Partial. |
| 5060 | Fall state | Unsupported | Required for knockdown. |
| 5070 | Fall state | Unsupported | Required for knockdown. |
| 5080 | Fall recovery state | Unsupported | Required for recovery. |
| 5090 | Fall recovery state | Unsupported | Required for recovery. |
| 5100 | Down state | Partial | Falling contact can enter the common bounce/down path without ground clamping hiding the crossing. Effects and full bounce variants remain incomplete. |
| 5110 | Down state | Partial | Common liedown path is reachable and `down.hittime` schedules State 5120. Full down velocity and animation variants remain incomplete. |
| 5120 | Recovery state | Unsupported | Required for recovery. |
| 5150 | Dead state | Unsupported | Required for KO behavior. |
| 5200 | Lie dead state | Unsupported | Required for KO behavior. |
| 5210 | Lie dead state | Unsupported | Required for KO behavior. |

## StateDef Header Fields

| Field | Purpose | Status | Notes |
|---|---|---|---|
| type | State type: S/C/A/L | Complete | Parsed and applied. |
| movetype | I/A/H | Complete | Parsed and applied. |
| physics | S/C/A/N | Partial | Parsed and applied. Physics behavior incomplete. |
| anim | Initial animation | Complete | Parsed and applied. Animless state preservation exists. |
| velset | Initial velocity | Partial | Numeric X/Y pairs apply on State entry before controllers; X is Facing-relative. Ground get-hit regression coverage verifies that State 5000 clears live `vy` while preserving `GetHitVar(yvel)`/`hitVelY`. Expression-valued header components need broader audit. |
| ctrl | Control flag | Complete | Parsed and applied. |
| poweradd | Power gain on state entry | Complete | Parsed and applied once when entering a state. |
| juggle | Juggle points | Partial | StateDef value is the air-hit cost; accepted new HitDef generations consume the target's `[Data] airjuggle` pool, insufficient hits are rejected, and grounded control recovery resets it. Helper/projectile/team semantics remain incomplete. |
| facep2 | Face opponent on state entry | Complete | Parsed and applied when entering a state; Debug Overlay exposes facing. |
| hitdefpersist | Keep HitDef on state change | Partial | Entered-State value 1 preserves ActiveHitDef, used state, and consumed-target history; 0 discards them. Helper/projectile/team ownership remains incomplete. |
| movehitpersist | Keep MoveHit info | Partial | Entered-State value 1 preserves MoveContact/MoveHit/MoveGuarded flags independently of hit count; 0 resets them. MoveReversed/team semantics remain incomplete. |
| hitcountpersist | Keep hit count | Partial | Entered-State value 1 preserves HitCount independently of result flags; 0 resets it. UniqHitCount and full team/combo semantics remain incomplete. |
| sprpriority | Sprite priority | Partial | Runtime field exists; rendering needs audit. |

## State Controller Compatibility

| Controller | Status | Notes |
|---|---|---|
| AfterImage | Partial | Recognized safe no-op. Rendering effect not implemented. |
| AfterImageTime | Partial | Stores duration field only. |
| AllPalFX | Partial | Recognized safe no-op. Palette effect not implemented. |
| AngleAdd | Partial | Tracks numeric angle only. Rendering transform incomplete. |
| AngleDraw | Partial | Recognized safe no-op. Rendering transform incomplete. |
| AngleMul | Partial | Tracks numeric angle only. Rendering transform incomplete. |
| AngleSet | Partial | Tracks numeric angle only. Rendering transform incomplete. |
| AppendToClipboard | Partial | Recognized safe no-op. Debug clipboard not implemented. |
| AssertSpecial | Partial | Recognized safe no-op. Flag effects not implemented. |
| AttackDist | Partial | Recognized safe no-op. Attack distance behavior not implemented. |
| AttackMulSet | Partial | Stores attack multiplier field only. |
| BGPalFX | Partial | Recognized safe no-op. Background palette effect not implemented. |
| BindToParent | Partial | Recognized safe no-op. Binding behavior not implemented. |
| BindToRoot | Partial | Recognized safe no-op. Binding behavior not implemented. |
| BindToTarget | Partial | Recognized safe no-op. Binding behavior not implemented. |
| ChangeAnim | Complete | Runtime value expressions are evaluated, including nested `ifelse`, velocity references, and `var()` arithmetic. |
| ChangeAnim2 | Partial | Recognized safe no-op. Target/common animation behavior not implemented. |
| ChangeState | Complete | Basic implementation exists and state entry is centralized. |
| ClearClipboard | Partial | Recognized safe no-op. Debug clipboard not implemented. |
| CtrlSet | Complete | Basic implementation exists. |
| DefenceMulSet | Partial | Stores defense multiplier field only. |
| DestroySelf | Partial | Recognized safe no-op. Helper destruction not implemented. |
| DisplayToClipboard | Partial | Recognized safe no-op. Debug clipboard not implemented. |
| EnvColor | Partial | Recognized safe no-op. Screen color flash not implemented. |
| EnvShake | Partial | Recognized safe no-op. Screen shake not implemented. |
| Explod | Partial | Issues #30-#32: production entries create, render owner AIR/SFF, advance age/AnimElem/time, distinguish removetime 0/positive/-1/-2 with finite/loop/infinite AIR, follow/release binds, and filter removal before Canvas. Separate ids, P1/P2 asset scope, coordinates/Facing/order, diagnostics, round cleanup, focused tests, and real-character evidence exist. Movement/render extensions, Pause/SuperPause, fightfx, non-zero camera exactness, Helper ownership, `persistent`, and `NumExplod` remain incomplete. |
| ExplodBindTime | Partial | Recognized safe no-op. Issue #25 defines owner-scoped id/bind selection; runtime behavior is scheduled for #39 after #30-#32. |
| FallEnvShake | Partial | Recognized safe no-op. Landing shake parameters are not connected to HitFeedback. |
| ForceFeedback | Partial | Recognized safe no-op. Input device feedback not implemented. |
| GameMakeAnim | Partial | Recognized safe no-op. Global animation effect not implemented. |
| Gravity | Partial | Recognized safe no-op. Physics layer applies gravity separately. |
| Helper | Partial | Recognized safe no-op in CNS runtime; Helper system exists separately. |
| HitAdd | Partial | Stores hit count field only. |
| HitBy | Partial | Normalized HitDef attr must match the stored allowed state/attack filter before live contact. Duration/stacking remains incomplete. |
| HitDef | Partial | Live paths apply independent kill/guard/fall rules, explicit power, numhits, edge-only cornerpush, snap and sprite priorities in addition to filtering/reactions/effects/chains/persistence. mugen.cfg power defaults, camera-relative edges, team validation, modifiers, full fightfx/SND, and Helper/projectile parity remain incomplete. |
| HitFallDamage | Partial | Applies snapshotted fall.damage at the common-State trigger and honors fall.kill; fall envshake/projectile parity remains incomplete. |
| HitFallSet | Partial | Recognized safe no-op. Fall flags not implemented. |
| HitFallVel | Partial | Restores the contact-snapshotted fall X/Y velocity for common bounce states. Full down-hit variants remain incomplete. |
| HitOverride | Partial | Recognized safe no-op. Override table not implemented. |
| HitVelSet | Partial | Treats X/Y as component flags and restores facing-converted contact velocity from the GetHitVar snapshot. Guard velocity remains incomplete. |
| LifeAdd | Complete | Basic implementation exists. |
| LifeSet | Complete | Basic implementation exists. |
| MakeDust | Partial | Recognized safe no-op. Dust rendering not implemented. |
| ModifyExplod | Partial | Issue #33: the normal CNS/app/GameState/Canvas path partially updates every explicit owner/id match. Supported fields are anim, pos/postype, facing/vfacing, bindtime, vel/accel/random, removetime, pause/supermovetime, scale, sprpriority/ontop, shadow/ownpal/removeongethit; omitted values persist, coordinates/render update in-frame, and removetime restarts from that frame. Duplicate ids and owner isolation are tested. Omitted `id` remains a diagnosed safe no-op because its selection boundary is not established. Movement/pause consumption and broader Helper/fightfx semantics remain Partial. |
| MoveHitReset | Complete | Clears current generation contact/hit/guard flags while preserving hit count and duplicate-target history; focused tests cover reset semantics. |
| MoveTypeSet | Complete | Basic implementation exists. |
| NotHitBy | Partial | Matching normalized HitDef state/attack attr rejects live contact. Duration/stacking remains incomplete. |
| Null | Complete | Explicit no-op. |
| Offset | Partial | Stores draw offset field only. Rendering needs audit. |
| PalFX | Partial | Recognized safe no-op. Palette effect not implemented. |
| ParentVarAdd | Partial | Recognized safe no-op. Parent var lookup not implemented. |
| ParentVarSet | Partial | Recognized safe no-op. Parent var lookup not implemented. |
| Pause | Partial | Stores pause time field only. Full pause effect handled elsewhere/incomplete. |
| PlayerPush | Partial | `value = 0` disables fallback stage push for its execution frame. Grounded players always use horizontal push; airborne cross-over requires fixed 44x80 boxes to clear vertically. Width/AIR `Clsn2` integration remains incomplete. |
| PlaySnd | Partial | Production CNS evaluates group/index and major parameters, resolves owner character SND, and plays through owner-scoped channels with volume scale, relative/absolute pan, playback rate, loop, diagnostics, and decode cache. Common `F` sound scope, lowpriority, and advanced Helper ownership remain unsupported. |
| PosAdd | Complete | Basic implementation exists. |
| PosFreeze | Partial | Recognized safe no-op. Freeze behavior not implemented. |
| PosSet | Complete | Basic implementation exists. |
| PowerAdd | Complete | Basic implementation exists. |
| PowerSet | Complete | Basic implementation exists. |
| Projectile | Partial | Recognized safe no-op in CNS runtime; Projectile system exists separately. |
| RemoveExplod | Partial | Issue #38: the normal CNS/app/GameState path removes every explicit owner/id match in controller order before lifecycle and same-frame Canvas rendering. Duplicate ids, owner isolation, bound/persistent entries, missing ids, ordering with ModifyExplod, neutral fixture rendering, and bundled T-H-M-A CNS are tested. Omitted `id` remains a diagnosed safe no-op because its selection boundary is not established; broader Helper ownership also remains Partial. |
| ReversalDef | Partial | Recognized safe no-op. Reversal behavior not implemented. |
| ScreenBound | Partial | Recognized safe no-op. Camera/screen bound behavior not implemented. |
| SelfState | Partial | Returns a borrowed player to `selfStateOwnerId` and executes that owner's CNS document. Helper/animation ownership remains incomplete. |
| SndPan | Partial | Production CNS evaluates owner/channel and relative `pan` or absolute `abspan`, then updates the current active/looping voice without recreating its source. Owner separation, replacement, natural end, clamping, and unsupported adapters are tested/diagnosed. Exact WinMUGEN pixel mapping and Helper ownership remain incomplete. |
| SprPriority | Partial | Stores priority field only. Rendering priority needs audit. |
| StateTypeSet | Complete | Basic implementation exists. |
| StopSnd | Partial | Production CNS evaluates channel and stops/releases the matching owner-scoped active or looping voice; P1/P2 channels remain separate and missing channels are diagnosed no-ops. Omitted-channel and advanced Helper ownership rules remain unsupported. |
| SuperPause | Partial | Stores super pause time field only. Full superpause behavior incomplete. |
| TargetBind | Partial | Selects registered targets by optional HitDef id, applies `pos` immediately, and stores time/offset metadata. Following-frame bind maintenance and full coordinate semantics remain incomplete. |
| TargetDrop | Partial | Removes registered targets selected by optional HitDef id; later controllers safely see no target. `excludeid` and Helper/multi-player behavior remain incomplete. |
| TargetFacing | Partial | Applies facing relative to the target owner for registered targets selected by optional HitDef id. Helper/multi-player behavior remains incomplete. |
| TargetLifeAdd | Partial | Adds and clamps life on registered targets selected by optional HitDef id. Secondary `kill`/absolute semantics remain incomplete. |
| TargetPowerAdd | Partial | Adds and lower-clamps power on registered targets selected by optional HitDef id. Full power-limit and Helper/multi-player semantics remain incomplete. |
| TargetState | Partial | Enters the requested State with the controller owner's CNS document; SelfState returns to the target owner. Helper/multi-player and animation ownership remain incomplete. |
| TargetVelAdd | Partial | Adds evaluated X/Y velocity to registered targets selected by optional HitDef id. Helper/multi-player behavior remains incomplete. |
| TargetVelSet | Partial | Sets evaluated X/Y velocity on registered targets selected by optional HitDef id. Helper/multi-player behavior remains incomplete. |
| Trans | Partial | Stores transparency mode only. Rendering needs audit. |
| Turn | Complete | Flips facing. |
| VarAdd | Complete | Basic implementation exists. |
| VarRandom | Partial | Deterministic midpoint placeholder. True RNG/range semantics incomplete. |
| VarRangeSet | Partial | Basic integer var range set exists. Full syntax incomplete. |
| VarSet | Complete | Basic implementation exists. |
| VelAdd | Complete | X values are facing-relative and converted once to world velocity. |
| VelMul | Complete | Multiplies the stored world velocity without reapplying facing. |
| VelSet | Complete | X values are facing-relative; positive X moves forward for either facing. |
| Width | Partial | Stores width fields only. Collision integration needs audit. |
| Zoom | Partial | Recognized safe no-op. Camera zoom not implemented. |

## HitDef Auxiliary Parameter Compatibility

| Parameter | Status | Notes |
|---|---|---|
| affectteam | Unsupported | Parsed as controller data but not used by live target eligibility. |
| air.fall | Unsupported | Separate air-fall override is not applied; the basic fall flag remains Partial. |
| air.hittime | Partial | Selects airborne hit-stun time at contact; advanced air recovery branches remain incomplete. |
| air.type | Partial | Snapshotted into GetHitVar and reaction selection; uncommon branches remain incomplete. |
| air.velocity | Partial | Applies airborne reaction velocity with Facing conversion; projectile parity remains incomplete. |
| airground.velocity | Unsupported | Legacy air-to-ground velocity override is not applied. |
| airguard.velocity | Unsupported | Legacy air-guard alias is not applied; `guard.velocity` is the connected path. |
| animtype | Partial | Light/Medium/Hard ground reactions are connected; Back/Up/DiagUp and missing animation behavior remain Partial. |
| attr | Partial | Normalized State/attack categories drive HitBy/NotHitBy/HitDefAttr; throw/projectile edges remain incomplete. |
| damage | Partial | Normal and guarded values reach live contact with KO rules; scaling/projectile parity remains incomplete. |
| down.hittime | Partial | Schedules common liedown/getup timing; advanced down branches remain incomplete. |
| down.velocity | Partial | Snapshotted for common down/fall paths; bounce variants remain incomplete. |
| envshake.ampl | Partial | Stored in the accepted-contact shake envelope and Canvas feedback. |
| envshake.freq | Partial | Stored in the accepted-contact shake envelope and Canvas feedback. |
| envshake.phase | Partial | Stored in the accepted-contact shake envelope and Canvas feedback. |
| envshake.time | Partial | Starts accepted-contact Canvas shake; fight-wide effect parity remains incomplete. |
| fall | Partial | Drives common air-fall routing and GetHitVar; advanced variants remain incomplete. |
| fall.animtype | Partial | Snapshotted and diagnosed; full fall animation selection remains incomplete. |
| fall.recover | Partial | Controls common air recovery eligibility. |
| fall.recovertime | Partial | Controls common air recovery timing. |
| ground.hittime | Partial | Selects grounded hit-stun time; advanced common reactions remain incomplete. |
| ground.slidetime | Partial | Snapshotted into GetHitVar; complete sliding semantics remain incomplete. |
| ground.type | Partial | Snapshotted into GetHitVar/reaction metadata; uncommon branches remain incomplete. |
| ground.velocity | Partial | Applies grounded reaction velocity with Facing conversion. |
| groundguard.velocity | Unsupported | Legacy ground-guard alias is not applied; `guard.velocity` is the connected path. |
| guard.ctrltime | Partial | Delays control restoration on live guard routes. |
| guard.dist | Partial | Gates guard intent by attacker/target center distance; width/camera precision remains incomplete. |
| guard.hittime | Partial | Selects live guard stun time. |
| kill | Partial | Normal contact honors 0 by clamping the defender to one Life and honors 1/default by permitting KO. Projectile parity remains incomplete. |
| guard.kill | Partial | Guard contact independently clamps chip damage at one Life when 0. Projectile parity remains incomplete. |
| guard.pausetime | Partial | Applies separate attacker/defender guard pause counters. |
| guard.slidetime | Unsupported | Guard slide timing is not independently applied. |
| guard.sparkno | Partial | Selects the guard spark effect envelope; full fightfx animation remains incomplete. |
| guard.sparkxy | Unsupported | Legacy guard-only spark offset is not applied; common `sparkxy` is connected. |
| guard.velocity | Partial | Applies live guard recoil with Facing conversion. |
| guardflag | Partial | Selects standing/crouching/air guard eligibility. |
| guardpausetime | Unsupported | Unprefixed legacy alias is not applied; `guard.pausetime` is connected. |
| guardsound | Partial | Selects scoped guard sound cue; character SND bytes are loadable, but Browser Audio playback remains unavailable. |
| hitflag | Partial | H/L/M/A/F/D target classes are connected; `+`/`-` modifiers remain unsupported. |
| hitsound | Partial | Selects scoped hit sound cue; character SND bytes are loadable, but Browser Audio playback remains unavailable. |
| fall.kill | Partial | Snapshotted into GetHitVar and honored by common-State HitFallDamage independently of normal/guard kill. Projectile parity remains incomplete. |
| getpower | Partial | Explicit hit/guard values are applied once to the attacker and clamped to 0..3000. mugen.cfg-derived omitted defaults remain unavailable. |
| givepower | Partial | Explicit hit/guard values are applied once to the defender and clamped to 0..3000. mugen.cfg-derived omitted defaults remain unavailable. |
| numhits | Partial | Adds the configured value to defender combo/GetHitVar(hitcount) once while attacker HitCount remains one per accepted target contact. Team display semantics remain incomplete. |
| ground.cornerpush.veloff | Partial | Applies Facing-relative attacker X velocity only when a grounded target is at the fallback stage boundary. Camera-relative boundaries remain incomplete. |
| air.cornerpush.veloff | Partial | Applies Facing-relative attacker X velocity only when an airborne target is at the fallback stage boundary. Camera-relative boundaries remain incomplete. |
| down.cornerpush.veloff | Partial | Applies Facing-relative attacker X velocity only when a down target is at the fallback stage boundary. Camera-relative boundaries remain incomplete. |
| guard.cornerpush.veloff | Partial | Applies Facing-relative attacker X velocity only for grounded guard at the fallback stage boundary. Camera-relative boundaries remain incomplete. |
| airguard.cornerpush.veloff | Partial | Applies Facing-relative attacker X velocity only for air guard at the fallback stage boundary. Camera-relative boundaries remain incomplete. |
| snap | Partial | Sets target X/Y from attacker position with X transformed by attacker Facing. Stage/camera clamping occurs in the existing later stage pass. |
| p1sprpriority | Partial | Applies attacker runtime sprite priority on accepted hit or guard; Canvas draws higher priority later. Projectile/effect layering remains incomplete. |
| p2sprpriority | Partial | Applies defender runtime sprite priority on accepted hit or guard; Canvas draws higher priority later. Projectile/effect layering remains incomplete. |
| p1facing | Unsupported | HitDef-specific attacker Facing override is not applied. |
| p1stateno | Partial | Enters attacker-owned custom State on accepted contact. |
| p2facing | Unsupported | HitDef-specific defender Facing override is not applied. |
| palfx.add | Unsupported | HitDef defender palette add effect is not applied. |
| palfx.time | Unsupported | HitDef defender palette effect duration is not applied. |
| pausemovetime | Unsupported | HitDef-specific pause move-time override is not applied. |
| pausetime | Partial | Applies separate attacker/defender hit-pause counters. |
| priority | Partial | Numeric priority and Hit/Miss/Dodge equal-clash behavior are connected; mixed-type edges remain incomplete. |
| sparkno | Partial | Selects scoped hit spark envelope; full sprite animation remains incomplete. |
| sparkxy | Partial | Applies Facing-relative offset to the Clsn contact point. |
| supermovetime | Unsupported | HitDef-specific super-pause move-time override is not applied. |
| yaccel | Partial | Snapshotted into GetHitVar for common air reaction logic. |

## Trigger Compatibility

| Trigger | Status | Notes |
|---|---|---|
| Abs | Complete | `Abs(...)` supported for numeric expressions. |
| ACos | Complete | Numeric math function supported in runtime trigger evaluator. |
| AILevel | Complete | Basic trigger support with default 0. |
| Alive | Complete | Basic support. |
| Anim | Complete | Numeric comparison. |
| AnimElem | Complete | Simplified approximation. |
| AnimElemNo | Partial | Uses runtime animation element lookup when provided; AIR timing edge cases still need audit. |
| AnimElemTime | Complete | Simplified approximation. |
| AnimExist | Partial | Evaluates through runtime animation lookup when provided; AIR ownership edge cases still need audit. |
| AnimTime | Complete | Uses MUGEN-style animation duration helper. |
| ASin | Complete | Numeric math function supported in runtime trigger evaluator. |
| ATan | Complete | Numeric math function supported in runtime trigger evaluator. |
| AuthorName | Partial | String source exists; metadata currently defaults empty. |
| BackEdge | Unsupported | Screen/camera edge value not implemented. |
| BackEdgeBodyDist | Partial | Uses fixed fallback stage bounds and player center; camera/body-width precision remains incomplete. |
| BackEdgeDist | Partial | Uses internal screen/player coordinate approximation. |
| BodyDist X | Partial | Evaluates opponent center distance like P2BodyDist X; precise body edge width is still incomplete. |
| BodyDist Y | Partial | Evaluates opponent/player Y coordinate difference like P2BodyDist Y; precise body edge height is still incomplete. |
| CanRecover | Partial | Reads fall.recover and fall.recovertime during the common air-fall path. Broader recovery command/state behavior remains incomplete. |
| Ceil | Complete | `Ceil(...)` supported for numeric expressions. |
| Command | Complete | Basic command set matching. |
| Cond | Complete | Numeric conditional function supported in runtime trigger evaluator. |
| Const | Partial | Common constants return default approximations. |
| Cos | Complete | Numeric math function supported in runtime trigger evaluator. |
| Ctrl | Complete | Basic support. |
| DrawGame | Partial | Safe default false. Round result not implemented. |
| E | Complete | Numeric math constant supported in runtime trigger evaluator. |
| Exp | Complete | Numeric math function supported in runtime trigger evaluator. |
| Facing | Complete | Numeric comparison. |
| Floor | Complete | `Floor(...)` supported for numeric expressions. |
| FrontEdge | Unsupported | Screen/camera edge value not implemented. |
| FrontEdgeBodyDist | Partial | Uses fixed fallback stage bounds and player center; camera/body-width precision remains incomplete. |
| FrontEdgeDist | Partial | Uses internal screen/player coordinate approximation. |
| FVar | Partial | `fvar(n)` lookup supported with default 0. |
| GameTime | Partial | Context/player fallback exists; real global frame integration needs audit. |
| GetHitVar | Partial | Contact snapshot supplies damage, hit/slide/control time, velocity, type/anim codes, fall damage/kill, combo hitcount, snap xoff/yoff, ids, guarded, and yaccel across get-hit State changes. Unsupported zoff/fall-time keys are diagnosed safe defaults. |
| HitCount | Partial | Counts accepted hits across ActiveHitDef generations; `hitcountpersist` independently preserves or resets it on State entry. UniqHitCount and full multi-target semantics remain incomplete. |
| HitDefAttr | Partial | Compares State and attack categories against the same normalized attr snapshot used by live HitBy/NotHitBy filtering. Redirect and malformed-attr edge cases remain incomplete. |
| HitFall | Partial | Reads the contact-snapshotted HitDef fall flag through common air get-hit states. Guard/projectile parity remains incomplete. |
| HitOver | Partial | Safe default true. |
| HitPauseTime | Complete | Reads player hitPause. |
| HitShakeOver | Partial | Safe default true. |
| HitVel X | Partial | Optional hit velocity field, default 0. |
| HitVel Y | Partial | Optional hit velocity field, default 0. |
| ID | Unsupported | Player/helper id trigger not implemented. |
| IfElse | Complete | Numeric conditional function supported in runtime trigger evaluator. |
| InGuardDist | Partial | Simple distance approximation. |
| IsHelper | Partial | Safe default 0. |
| IsHomeTeam | Unsupported | Team metadata not implemented. |
| Life | Complete | Numeric comparison. |
| LifeMax | Partial | Default 1000. |
| Ln | Complete | Numeric math function supported in runtime trigger evaluator. |
| Log | Complete | Numeric math function supported in runtime trigger evaluator. |
| Lose | Partial | Safe default false. Round result not implemented. |
| LoseKO | Unsupported | Round result not implemented. |
| LoseTime | Unsupported | Round result not implemented. |
| MatchNo | Unsupported | Match metadata not implemented. |
| MatchOver | Unsupported | Match flow not implemented. |
| MoveContact | Partial | Reads real hit or guarded contact state for the current ActiveHitDef generation; `movehitpersist` independently preserves or resets result flags on State entry. MoveReversed/team semantics remain incomplete. |
| MoveGuarded | Partial | Guardflag-approved live contact sets guarded without setting MoveHit; persist headers remain incomplete. |
| MoveHit | Partial | Reads accepted-hit state and drives tested hit-confirm cancel routes; persistence remains incomplete. |
| MoveReversed | Unsupported | Reversal/contact state not implemented. |
| MoveType | Complete | Basic support. |
| Name | Partial | String source exists; metadata defaults empty. |
| NumEnemy | Partial | Safe default 1. |
| NumExplod | Partial | Production Explod entries now exist, but this trigger still returns safe default 0; owner plus optional MUGEN id lookup remains unconnected. |
| NumHelper | Partial | Safe default 0. |
| NumPartner | Partial | Safe default 0. |
| NumProj | Partial | Safe default 0. |
| NumProjID | Partial | Safe default 0. |
| NumTarget | Partial | Counts registered HitDef targets with optional HitDef id filtering; Helper/multi-player lookup remains incomplete. |
| TargetID | Partial | Returns the first registered target player id, optionally filtered by HitDef id. |
| TargetStateNo | Partial | Returns current StateNo for the selected two-player target; Helper/multi-player lookup remains incomplete. |
| P1Name | Unsupported | Alias not implemented. `Name` exists. |
| P2BodyDist X | Partial | Uses opponent/player coordinate difference. |
| P2BodyDist Y | Partial | Uses opponent/player coordinate difference. |
| P2Dist X | Partial | Uses opponent/player coordinate difference. |
| P2Dist Y | Partial | Uses opponent/player coordinate difference. |
| P2Life | Partial | Uses opponent life or default. |
| P2MoveType | Partial | Opponent move type supported. |
| P2Name | Partial | Opponent metadata source exists, default empty. |
| P2StateNo | Partial | Opponent stateNo supported. |
| P2StateType | Partial | Opponent state type supported. |
| P3Name | Unsupported | Team metadata not implemented. |
| P4Name | Unsupported | Team metadata not implemented. |
| PalNo | Unsupported | Palette slot trigger not implemented. |
| ParentDist X | Unsupported | Parent distance not implemented. |
| ParentDist Y | Unsupported | Parent distance not implemented. |
| Pi | Complete | Numeric math constant supported in runtime trigger evaluator. |
| PlayerIDExist | Unsupported | Player/helper lookup by id not implemented. |
| Pos X | Complete | Basic X comparison. |
| Pos Y | Complete | Basic Y comparison. |
| Power | Complete | Basic support with default 0. |
| PowerMax | Partial | Default 3000. |
| PrevStateNo | Partial | Optional field read; previous-state tracking incomplete. |
| ProjCancelTime | Partial | Safe default -1. |
| ProjContact | Unsupported | Boolean projectile contact not implemented. |
| ProjContactTime | Partial | Safe default -1. |
| ProjGuarded | Unsupported | Boolean projectile guarded not implemented. |
| ProjGuardedTime | Partial | Safe default -1. |
| ProjHit | Unsupported | Boolean projectile hit not implemented. |
| ProjHitTime | Partial | Safe default -1. |
| Random | Partial | Deterministic placeholder 500. |
| RootDist X | Unsupported | Root distance not implemented. |
| RootDist Y | Unsupported | Root distance not implemented. |
| RoundNo | Partial | Context/default support. |
| RoundsExisted | Partial | Safe default true. |
| RoundState | Complete | Basic support with default 2 unless supplied. |
| ScreenPos X | Partial | Uses internal position approximation. |
| ScreenPos Y | Partial | Uses internal position approximation. |
| SelfAnimExist | Partial | Evaluates through runtime self-animation lookup when provided; redirect-specific AIR ownership still needs audit. |
| Sin | Complete | Numeric math function supported in runtime trigger evaluator. |
| StateNo | Complete | Numeric comparison. |
| StateTime | Partial | Real-character compatibility alias reads the same current State time as `Time`; WinMUGEN-version provenance remains under audit. |
| StateType | Complete | Basic support. |
| SysFVar | Unsupported | System float vars not implemented. |
| SysVar | Complete | Basic numeric comparison. |
| Tan | Complete | Numeric math function supported in runtime trigger evaluator. |
| TeamMode | Unsupported | Team mode not implemented. |
| TeamSide | Partial | Context/player id fallback. |
| TicksPerSecond | Complete | Constant 60. |
| Time | Complete | State time comparison. |
| TimeMod | Partial | Evaluates State time modulo a positive divisor against the requested remainder; invalid divisors fail safely. `%` remains the preferred equivalent. |
| UniqHitCount | Unsupported | Hit counter not implemented. |
| Var | Complete | Basic numeric comparison. |
| Vel X | Complete | Exposes world X velocity relative to the player's facing. |
| Vel Y | Complete | Basic Y velocity comparison. |
| Win | Partial | Safe default false. Round result not implemented. |
| WinKO | Unsupported | Round result not implemented. |
| WinPerfect | Unsupported | Round result not implemented. |
| WinTime | Unsupported | Round result not implemented. |

## Redirects / Player References

| Redirect | Status | Notes |
|---|---|---|
| enemy | Partial | Redirect parser support exists; maps to opponent when present. |
| enemynear | Partial | Redirect parser support exists; maps to opponent when present. |
| helper | Unsupported | Helper lookup by id/name not implemented. |
| parent | Partial | Safe self fallback for non-helper runtime. |
| partner | Unsupported | Team mode not implemented. |
| root | Partial | Safe self fallback for non-helper runtime. |
| target | Partial | Safe opponent/self fallback; true target list not implemented. |
| playerid | Unsupported | Player lookup by id not implemented. |

## Expression / Operator Support

| Feature | Status | Notes |
|---|---|---|
| `=` | Complete | Simple numeric and string equality supported. |
| `!=` | Complete | Simple numeric and string inequality supported. |
| `>` | Complete | Simple numeric comparison supported. |
| `>=` | Complete | Simple numeric comparison supported. |
| `<` | Complete | Simple numeric comparison supported. |
| `<=` | Complete | Simple numeric comparison supported. |
| `= [a,b]` | Complete | Numeric range equality supported. |
| `!= [a,b]` | Complete | Numeric range inequality supported. |
| `triggerall` AND | Complete | Covered by trigger group evaluator. |
| `triggerN` OR | Complete | Multiple triggerN groups supported. |
| `&&` | Complete | Supported for simple expressions. |
| `||` | Complete | Supported for simple expressions. |
| `!` | Complete | Supported for simple expressions. |
| Parentheses | Partial | Outer/group parentheses supported; full expression grammar incomplete. |
| `+` | Complete | Supported in numeric trigger expressions with tests. |
| `-` | Complete | Binary subtraction supported in numeric trigger expressions with tests. |
| `*` | Complete | Supported in numeric trigger expressions with tests. |
| `/` | Complete | Supported in numeric trigger expressions with tests. Division by zero fails the expression safely. |
| `%` | Complete | Supported in numeric trigger expressions with tests. Modulo by zero fails the expression safely. |
| Unary minus | Partial | Supported as numeric literal. |
| `var(n)` | Complete | Basic integer var lookup supported. |
| `sysvar(n)` | Complete | Basic system var lookup supported. |
| `fvar(n)` | Partial | Float var lookup defaults to 0. |
| Redirect expression chain | Partial | `enemynear, stateno` style basic support. |

## CMD Compatibility

| Feature | Status | Notes |
|---|---|---|
| Single button commands | Complete | Basic support. |
| Hold direction `/D` | Complete | Basic support. |
| Hold direction `/F` | Complete | Basic support. |
| Hold direction `/B` | Complete | Basic support. |
| Hold direction `/U` | Complete | Basic support. |
| Direction sequences | Partial | Command matcher exists; needs WinMUGEN timing audit. |
| Button sequences | Partial | Basic support; simple button commands are kept briefly active so jump/crouch startup routes do not drop the input. |
| Simultaneous buttons | Partial | Needs full syntax audit. |
| Release commands | Untested | Check `~` syntax behavior. |
| Buffer time | Partial | InputBuffer exists; simple button and double-tap direction commands have short default post-match buffering. Double-tap directions no longer retrigger while the second direction is held, but full WinMUGEN timing still needs audit. |
| command.time | Untested | Parser/runtime status needs verification. |
| command.buffer.time | Partial | Parser and command matcher honor explicit buffer.time as a post-match active window; default buffering covers simple buttons and double-tap directions after release, but WinMUGEN timing audit still needed. |
| `$` direction match | Partial | KFM hold commands work; full syntax needs tests. |
| `/` hold prefix | Partial | Used in common commands. Needs syntax coverage. |
