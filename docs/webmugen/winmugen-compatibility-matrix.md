# WebMUGEN WinMUGEN Compatibility Matrix

Updated: 2026-07-13

This document is the working compatibility checklist for WebMUGEN. Every compatibility item is tracked on its own row. Do not combine multiple triggers, controllers, states, operators, redirects, or CMD features into a single matrix item.

Status is intentionally conservative: **Complete** requires either focused tests or a confirmed app integration path. Runtime shims with no game effect are **Safe no-op**; approximate alternate paths are **Fallback**, never Partial or Complete.

<!-- status-summary:start -->
- Complete: 132
- Partial: 167
- Fallback: 17
- Safe no-op: 36
- Issue ready: 0
- Not started: 59
- Audit needed: 8
<!-- status-summary:end -->

Baseline references:

- Elecbyte MUGEN CNS trigger reference: https://www.elecbyte.com/mugendocs-11b1/trigger.html
- Elecbyte MUGEN state controller reference: https://www.elecbyte.com/mugendocs-11b1/sctrls.html
- Elecbyte MUGEN CNS format reference: https://www.elecbyte.com/mugendocs-11b1/cns.html
- Elecbyte MUGEN common states reference: https://www.elecbyte.com/mugendocs-11b1/common1.html
- WinMUGEN-era behavior should be checked against actual WinMUGEN where 1.0/1.1 docs differ.

## Status Legend

| Status | Meaning |
|---|---|
| Complete | Intended runtime path is integrated and verified. |
| Partial NN% | Intended path is partly implemented; Notes identify implemented and missing scope. |
| Fallback NN% | An approximate alternative path exists and still needs compatible replacement. |
| Safe no-op | Runtime recognizes the item without changing game state. |
| Issue ready | A scoped implementation Issue exists, but implementation has not started. |
| Not started | No implementation, shim, or prepared Issue is confirmed. |
| Audit needed | Related code may exist, but runtime integration or evidence is unverified. |

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
| 40 | Jump start | Complete | Common holdup route selects character `jump.neu/fwd/back` and `runjump.fwd/back` pairs with one Facing conversion; focused runtime tests cover all profiles and both Facings. |
| 41 | Character-defined jump variant | Complete | Character-defined holdup override into State 41 is covered by CNS runtime assertions. |
| 42 | Character-defined jump variant | Complete | Character-defined holdup route into State 42 is covered by CNS runtime assertions. |
| 45 | Air jump / jump transition variant | Partial 60% | Implemented: Character-defined State 45 entry is covered; common air-jump rules still need WinMUGEN/common1 verification. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 50 | Jump up | Partial 60% | Implemented: Common air state uses character `movement.yaccel` once per Physics=A frame; two profiles have verified apex and airtime. Missing: broader coordinate scaling and uncommon air-state semantics. Evidence: focused jump trajectory and bundled real-character loader/runtime tests. |
| 51 | Jump down | Partial 60% | Implemented: Character-defined State 51 entry is covered; full common air-state sequencing is still incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 52 | Jump land | Partial 60% | Implemented: Character-specific jump trajectories enter State 52 on the measured ground-crossing frame with Y/velocity reset. Missing: broader stage-coordinate and uncommon landing semantics. Evidence: focused apex/airtime/landing tests. |
| 100 | Run / dash forward | Partial 40% | Implemented: Common route added with PosAdd. Common walk routes no longer interrupt dash states 100-107. Needs true velocity/friction behavior. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 101 | Run / dash substate | Audit needed | Common walk routes no longer interrupt dash states 100-107. Common implementations vary. |
| 102 | Run / dash substate | Audit needed | Common implementations vary. |
| 103 | Run / dash substate | Audit needed | Common implementations vary. |
| 104 | Run / dash substate | Audit needed | Common implementations vary. |
| 105 | Hop back / back dash | Partial 40% | Implemented: Common route added with PosAdd. Common walk routes no longer interrupt dash states 100-107. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 106 | Back dash substate | Audit needed | Common implementations vary. |
| 107 | Back dash substate | Audit needed | Common implementations vary. |
| 120 | Guard start | Partial 40% | Implemented: Common guard-start controllers execute; proactive pre-contact routing remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 130 | Standing guard | Partial 40% | Implemented: Standing GuardHit returns to the unmodified common standing guard while holdback and guard distance remain valid. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 131 | Crouching guard | Partial 40% | Implemented: Crouch guard and common high/low transitions execute; broader command timing remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 132 | Air guard | Partial 40% | Implemented: Air guardflag contact enters the common air GuardHit path; full landing variants remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 140 | Guard end | Partial 40% | Implemented: Common U-type guard-end state preserves StateType/physics and releases guard. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 150 | Standing GuardHit shake | Partial 40% | Implemented: H/M-guarded standing contact enters this common state with guard pause/hit time snapshot. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 151 | Standing GuardHit recoil | Partial 60% | Implemented: Common HitVelSet/HitOver path is integration-tested. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 152 | Crouching GuardHit shake | Partial 40% | Implemented: L/M-guarded crouch contact enters this common state. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 153 | Crouching GuardHit recoil | Partial 55% | Implemented: Common crouch recoil path is connected; advanced timing remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 154 | Air GuardHit shake | Partial 40% | Implemented: A-guarded air contact enters this common state. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 155 | Air GuardHit recoil | Partial 40% | Implemented: Common air recoil path receives guard velocity; full landing behavior remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 170 | Lose state | Not started | Round flow only partially implemented. |
| 171 | Lose state | Not started | Round flow only partially implemented. |
| 172 | Lose state | Not started | Round flow only partially implemented. |
| 173 | Lose state | Not started | Round flow only partially implemented. |
| 180 | Win state | Not started | Round flow only partially implemented. |
| 181 | Win state | Not started | Round flow only partially implemented. |
| 190 | Intro state | Not started | Round intro not implemented. |
| 191 | Intro state | Not started | Round intro not implemented. |
| 192 | Intro state | Not started | Round intro not implemented. |
| 193 | Intro state | Not started | Round intro not implemented. |
| 194 | Intro state | Not started | Round intro not implemented. |
| 195 | Intro state | Not started | Round intro not implemented. |
| 196 | Intro state | Not started | Round intro not implemented. |
| 197 | Intro state | Not started | Round intro not implemented. |
| 198 | Intro state | Not started | Round intro not implemented. |
| 199 | Intro state | Not started | Round intro not implemented. |
| 5000 | Common get-hit state | Complete | Implemented: Issue #59 verifies standing contact entry, High/Low and all six animtypes, optional Up/DiagUp fallback, velset/header order, persistent GetHitVar, real HitShakeOver, launch/fall branches, P1/P2, Facing, hitpause, and terminal Controller order against the unmodified common1.cns. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5001 | Common get-hit state | Complete | Implemented: Issue #59 verifies ground slide entry, HitVelSet X restore, AnimTime continuation, slidetime friction, independent HitOver, early-ctrl suppression, P1/P2 symmetry, and the common State 0 ctrl=1 exit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5010 | Common get-hit state | Complete | Implemented: Issue #59 verifies crouching contact entry, six animtype branches, StateTypeSet launch/fall behavior, persistent snapshot, real HitShakeOver, and terminal routing to 5011 or 5030 against the unmodified common1.cns. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5011 | Common get-hit state | Complete | Implemented: Issue #59 verifies crouch slide HitVelSet/Anim/slidetime/HitOver behavior, early-ctrl suppression, and the common State 11 ctrl=1 exit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5020 | Common get-hit state | Complete | Implemented: Issue #59 verifies air-only contact entry, air.type and air.animtype selection including Back/Up/DiagUp fallback, air hittime/velocity snapshot, hitpause clock separation, real HitShakeOver, and terminal routing to 5030. Guard contact remains correctly isolated in States 150/152/154. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5030 | Fall state | Complete | Implemented: Issue #60 verifies HitVelSet, per-frame GetHitVar(yaccel), HitOver/HitFall routing, animation completion, unclamped downward ground crossing, hitpause, and persistent HitDef snapshot against unmodified common1.cns. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5035 | Fall state | Complete | Implemented: Issue #60 verifies optional transition animation selection, gravity, non-fall/fall routing, no-transition behavior, ground crossing, and terminal controller order. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5040 | Fall state | Complete | Implemented: Issue #60 verifies non-fall air recovery, KO fallback, Anim/CtrlSet/StateTypeSet behavior after HitOver, gravity, and the State 52 landing route. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5050 | Fall state | Complete | Implemented: Issue #60 verifies 5050-to-5060 descending animation selection, gravity, independent fall.recover/recovertime plus recovery input gating, and ground-crossing routing to bounce/down. Recovery destination States 5200/5210 are tracked separately. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5060 | Fall animation family | Complete | Implemented: WinMUGEN common1.cns has no StateDef 5060. Issue #60 verifies that 5060 is selected as the descending animation while State 5050 remains active; no fabricated StateDef or state-number hack is used. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5070 | Trip fall state | Complete | Implemented: Issue #60 verifies State 5070 hit-shake freeze and terminal transition to 5071, then stored HitVelSet, yaccel, and ground routing in 5071. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5071 | Trip fall continuation state | Complete | Issue #63 audits the previously omitted Matrix row; Issue #60 focused tests verify HitVelSet, per-frame yaccel, animation transition, and ground routing to 5100/5110 through the unmodified common StateDef. |
| 5080 | Downed get-hit state | Complete | Implemented: Issue #61 verifies lying-hit entry, HitShakeOver freeze, yvel-based 5080/5090 animation choice, down.hittime/down.velocity, and terminal routing to 5081 or 5030 for P1/P2. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5081 | Downed slide state | Complete | Implemented: Issue #61 verifies HitVelSet X, HitOver stop, ground friction, sysvar ground-frame suppression, and terminal State 5110 routing. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5090 | Downed launch animation family | Complete | Implemented: WinMUGEN common1.cns has no StateDef 5090. Issue #61 verifies that State 5080 selects Anim 5090 for a lying target launched by nonzero down.velocity.y, with fallback to Anim 5030 only when 5090 is absent. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5100 | Down state | Complete | Implemented: Issue #61 verifies unclamped falling contact, landing animation variants, ground positioning, velocity reduction, fall damage, down.bounce/no-bounce selection, and terminal routing to 5101 or 5110. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5101 | Bounce state | Complete | Implemented: Issue #61 verifies HitFallVel restoration, default fall.yvelocity, bounce positioning, per-frame acceleration, and the second ground crossing into State 5110. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5110 | Down state | Complete | Implemented: Issue #61 verifies landing animation variants, fall damage, ground position/velocity, friction, KO routing ownership, and an independent Data.liedown.time clock. down.hittime is correctly used only as lying-hit slide time. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5120 | Recovery state | Complete | Implemented: Issue #61 verifies get-up animation variants, zero X velocity, timed two-slot NotHitBy immunity, HitFallSet, terminal State 0 ctrl=1, and suppression of automatic get-up when Life is zero. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| 5150 | Lying-dead KO state | Complete | Issue #62 verifies Life-zero entry after hitpause, ctrl-off hold, 5140/5150 animation families, missing-animation fallback, NotHitBy/collision exclusion, MatchOver integration, and recovery-input lockout for P1/P2 without changing common1.cns. |
| 5200 | Airborne fall-recovery state | Complete | Issue #62 corrects the prior dead-state label and verifies GetHitVar(yaccel), falling animation continuity, and the near-ground route into 5201. |
| 5201 | Ground-assisted fall-recovery state | Complete | Issue #62 verifies recovery Anim/velocity/position, one-tick NotHitBy immunity, and continued airborne recovery physics. |
| 5210 | Airborne fall-recovery state | Complete | Issue #62 corrects the prior dead-state label and verifies Time-0 PosFreeze, recovery steering/gravity, timed immunity/control, and State 52 landing. |

## StateDef Header Fields

| Field | Purpose | Status | Notes |
|---|---|---|---|
| type | State type: S/C/A/L | Complete | Parsed and applied. |
| movetype | I/A/H | Complete | Parsed and applied. |
| physics | S/C/A/N | Partial 75% | Implemented: Physics=A applies character `movement.yaccel` once, Physics=N preserves explicit controller motion, and common jump landing is frame-tested. Missing: exact ground friction, coordinate scaling, and broader stage behavior. Evidence: focused jump, motion, and air-hit regression tests. |
| anim | Initial animation | Complete | Parsed and applied, including runtime expressions such as `6142 + IfElse(...)`; non-finite results are rejected instead of storing `animNo = NaN`. A second same-tick ChangeState destination retains its first `Time = 0` pass for the next CNS tick. Issue #55 renderer coverage skips missing AIR actions/elements/SFF sprites, negative sprite references, and `AssertSpecial invisible` without Anim 0/Sprite 0/other-owner/debug fallback; `raw.render` preserves distinct reasons. The debug figure remains only when no character SpritePack was loaded. This safe draw-skip behavior does not promote other AIR/SFF rows to Complete; real-game confirmation is pending. |
| velset | Initial velocity | Partial 40% | Implemented: Numeric X/Y pairs apply on State entry before controllers; X is Facing-relative. Ground get-hit regression coverage verifies that State 5000 clears live `vy` while preserving `GetHitVar(yvel)`/`hitVelY`. Expression-valued header components need broader audit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| ctrl | Control flag | Complete | Parsed and applied before State -3/-2/-1 on each CNS tick. Issue #56 verifies that a positive-State `ChangeState ctrl = 1` does not leak into the next tick's State -1 when the entered StateDef declares `ctrl = 0`; a same-tick State -2 `CtrlSet` still reaches State -1, and genuinely controlled standing States may enter common walk State 20/21. |
| poweradd | Power gain on state entry | Complete | Parsed, applied once when entering a state, and clamped through the shared 0..character `powerMax` path. Focused Issue #52 tests cover entry-only consumption. |
| juggle | Juggle points | Partial 55% | Implemented: StateDef value is the air-hit cost; accepted new HitDef generations consume the target's `[Data] airjuggle` pool, insufficient hits are rejected, and grounded control recovery resets it. Helper/projectile/team semantics remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| facep2 | Face opponent on state entry | Complete | Parsed and applied when entering a state; Debug Overlay exposes facing. |
| hitdefpersist | Keep HitDef on state change | Partial 40% | Implemented: Entered-State value 1 preserves ActiveHitDef, used state, and consumed-target history; 0 discards them. Helper/projectile/team ownership remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| movehitpersist | Keep MoveHit info | Partial 55% | Implemented: Entered-State value 1 preserves MoveContact/MoveHit/MoveGuarded flags independently of hit count; 0 resets them. MoveReversed/team semantics remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| hitcountpersist | Keep hit count | Partial 55% | Implemented: Entered-State value 1 preserves HitCount independently of result flags; 0 resets it. UniqHitCount and full team/combo semantics remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| sprpriority | Sprite priority | Partial 70% | Implemented: Runtime field exists; rendering needs audit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |

## State Controller Compatibility

| Controller | Status | Notes |
|---|---|---|
| AfterImage | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Rendering effect not implemented. |
| AfterImageTime | Partial 50% | Implemented: Stores duration field only. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| AllPalFX | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Palette effect not implemented. |
| AngleAdd | Partial 40% | Implemented: Tracks numeric angle only. Rendering transform incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| AngleDraw | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Rendering transform incomplete. |
| AngleMul | Partial 40% | Implemented: Tracks numeric angle only. Rendering transform incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| AngleSet | Partial 40% | Implemented: Tracks numeric angle only. Rendering transform incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| AppendToClipboard | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Debug clipboard not implemented. |
| AssertSpecial | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Flag effects not implemented. |
| AttackDist | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Attack distance behavior not implemented. |
| AttackMulSet | Partial 50% | Implemented: Stores attack multiplier field only. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| BGPalFX | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Background palette effect not implemented. |
| BindToParent | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Binding behavior not implemented. |
| BindToRoot | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Binding behavior not implemented. |
| BindToTarget | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Binding behavior not implemented. |
| ChangeAnim | Complete | Runtime value expressions are evaluated, including nested `ifelse`, velocity references, and `var()` arithmetic. Non-finite results are rejected instead of storing `animNo=NaN`; Human Log shows each controller's raw and evaluated `value`. |
| ChangeAnim2 | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Target/common animation behavior not implemented. |
| ChangeState | Complete | State entry is centralized; a successful ordinary-State transition terminates the remaining controller list, preventing later fallback ChangeState controllers from overwriting the selected route. Negative command States retain entry-snapshot scanning. |
| ClearClipboard | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Debug clipboard not implemented. |
| CtrlSet | Complete | Basic implementation exists. |
| DefenceMulSet | Partial 50% | Implemented: Stores defense multiplier field only. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| DestroySelf | Partial 60% | Implemented: Issue #58 Phase1 queues destruction for the current Helper entity and removes it at the controller-pass commit point, before later rendering/physics. Root execution does not destroy the player. Missing: child-parent disappearance policy, pause allowances, and HitDef/collision cleanup. Evidence: focused Helper lifecycle tests. |
| DisplayToClipboard | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Debug clipboard not implemented. |
| EnvColor | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Screen color flash not implemented. |
| EnvShake | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Screen shake not implemented. |
| Explod | Partial 92% | Implemented: Issues #37/#45/#46 verify production CNS/GameState/AIR paths plus SFF v1 shared and sprite-specific palettes, subfile-order `samePalette` inheritance, linked sprite palette context, ACT-only reversed index lookup, transparent index, AIR Preview/normal/Explod owner RGBA parity, cross-owner/cache-key isolation, and separate `ownpal` surfaces. Real KFM State 191 and T-H-M-A Action 15001 sprite pixels are non-black with expected palette metadata. SFF v2, dynamic palette effects, destination/subtractive blend, shadows, common fightfx assets, camera exactness, Helper ownership, generic `persistent`, and `NumExplod` remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| ExplodBindTime | Partial 80% | Implemented: No occurrence in the three-character Issue #37 set; explicit-ID lifecycle fixtures remain the evidence. Omitted `id`, non-player owner disappearance/reload, and non-binding postype edge rules remain Partial. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| FallEnvShake | Complete | Reads snapshotted fall.envshake time/frequency/amplitude/phase and starts shared Canvas screen shake; zero time is a tested no-effect execution. Issue #62 verifies the common landing route. |
| ForceFeedback | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Input device feedback not implemented. |
| GameMakeAnim | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Global animation effect not implemented. |
| Gravity | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Physics layer applies gravity separately. |
| Helper | Partial 45% | Implemented: Issue #58 Phase1 connects CNS Helper controllers to an independent GameState entity collection with unique runtime IDs separate from duplicate MUGEN IDs, root/parent/owner/state/animation ownership, requested State/Anim, deferred first step, P1/P2 and nested spawning, owner AIR/SFF rendering, NumHelper, DestroySelf, diagnostics, and round-reset cleanup. Missing: redirect evaluation, keyctrl details, palette mutation, Bind/ParentVar, push/collision/HitDef/Target, and pause semantics. Evidence: focused entity/runtime/render/lifecycle tests. |
| HitAdd | Partial 50% | Implemented: Stores hit count field only. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| HitBy | Complete | Implemented: Issue #61 implements both WinMUGEN attribute slots, value/value2 selection, independent timers, pause freeze, and all-active-slot matching. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| HitDef | Partial 85% | Implemented: Issue #36 routes one normal/guard contact effect per HitEvent into shared Explod and Sound runtimes. `S`-scoped expression animations/sounds use attacker AIR/SFF/SND; unprefixed/`F` use injected common assets. Bundled common fightfx/SND assets, Helper/projectile parity, modifiers, and mixed priority edges remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| HitFallDamage | Partial 55% | Implemented: Applies snapshotted fall.damage at the common-State trigger, honors fall.kill, records fall KO reason, and cooperates with connected FallEnvShake. Missing: projectile parity and broader custom-state semantics. Evidence: focused fall damage/kill/shake and common KO route tests. |
| HitFallSet | Complete | Implemented: Issue #61 applies value/xvel/yvel to the persistent fall snapshot and verifies the common State 5120 use. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| HitFallVel | Partial 50% | Implemented: Restores the contact-snapshotted fall X/Y velocity for common bounce states. Full down-hit variants remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| HitOverride | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Override table not implemented. |
| HitVelSet | Partial 50% | Implemented: Treats X/Y as component flags and restores facing-converted contact velocity from the GetHitVar snapshot. Guard velocity remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| LifeAdd | Complete | Basic implementation exists. |
| LifeSet | Complete | Basic implementation exists. |
| MakeDust | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Dust rendering not implemented. |
| ModifyExplod | Partial 90% | Implemented: Issue #37 confirms real Yes030_e-rada usage and retains explicit owner/id production fixture evidence. Omitted `id` remains a diagnosed safe no-op; broader Helper/fightfx semantics remain Partial. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| MoveHitReset | Complete | Clears current generation contact/hit/guard flags while preserving hit count and duplicate-target history; focused tests cover reset semantics. |
| MoveTypeSet | Complete | Basic implementation exists. |
| NotHitBy | Complete | Implemented: Issue #61 implements both WinMUGEN attribute slots, state-only and attack-only filters, independent timers, pause freeze, and the State 5120 get-up immunity sequence. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| Null | Complete | Explicit no-op. |
| Offset | Partial 50% | Implemented: Stores draw offset field only. Rendering needs audit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| PalFX | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Palette effect not implemented. |
| ParentVarAdd | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Parent var lookup not implemented. |
| ParentVarSet | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Parent var lookup not implemented. |
| Pause | Partial 80% | Implemented: Issue #35: production CNS starts a match-level pause, freezes non-owner CNS/physics/timers and all negative States, permits the owner for `movetime`, gates Explods by `pausemovetime`, and prevents activation-side-effect replay. Same-pass controller ordering, Helpers, and less common parameters remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| PlayerPush | Partial 75% | Implemented: Issue #57 carries `[Size]` `ground.front/back`, `air.front/back`, `height`, `xscale`, and `yscale` into PlayerState and resolves a Facing-aware ground/air Push Box with one scale application. Both-axis overlap drives separation, `value = 0` disables it for the execution frame, and airborne cross-over preserves Facing. Canvas and `raw.push`/`raw.cross` expose the solver result. Missing: dynamic `Width` controller overrides, camera-relative bounds, and multi-entity push semantics. Evidence: focused Size/runtime/solver/Facing tests. |
| PlaySnd | Partial 90% | Implemented: Issue #37 resolves real SND samples for KFM, T-H-M-A, and Yes030_e-rada through production CNS for P1/P2. Loader priority is character/DEF `stcommon`, external `common1.cns`, then `common.cmd` routing; `common.cmd` no longer duplicates State 40. This preserves bundled T-H-M-A State 40 and its `Time = 1` sample `S40,0`; the production loader/runtime path is regression-tested. Pause boundaries and Browser Audio are connected. Issue #44 adds persistent master/mute controls. Issue #51 loads assets behind an Audio Start Gate, calls unlock directly from the overlay gesture, and creates BrowserInput/requestAnimationFrame only after the shared context reports `running`; retry, explicit no-audio continuation, once-only start, StrictMode disposal, and `audio_unlocked` before State 230 sample 230,1 playback are focused-tested without a Runtime-tab dependency. Issue #54 connects AnimElem to 1-based AIR element starts and verifies T-H-M-A State 101 sample `S100,1` at elements 1 and 4 across repeated loops. These loader/app lifecycle fixes do not raise controller compatibility progress. Generic controller `persistent = 0 / N`, common `F` archive, lowpriority, Helper ownership, and same-pass cross-player ordering remain Partial. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: focused real-character PlaySnd/AnimElem loop, AudioStartGate, BrowserAudioRuntime, and SoundRuntimeBridge tests plus production runtime inventory. |
| PosAdd | Complete | Basic implementation exists. |
| PosFreeze | Complete | Nonzero/default value skips position and velocity integration on the controller execution frame while StateTime/AnimTime advance; zero leaves motion enabled. Issue #62 verifies the common State 5210 route. |
| PosSet | Complete | Basic implementation exists. |
| PowerAdd | Complete | Mutates the current player's durable Power through the shared 0..character `powerMax` clamp; positive, negative, upper/lower clamp, and diagnostics are focused-tested by Issue #52. |
| PowerSet | Complete | Sets the current player's durable Power through the shared 0..character `powerMax` clamp; lower/upper clamp and diagnostics are focused-tested by Issue #52. |
| Projectile | Fallback 20% | Implemented: Recognized safe no-op in CNS runtime; Projectile system exists separately. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| RemoveExplod | Partial 85% | Implemented: Issue #37 confirms real T-H-M-A and Yes030_e-rada usage and retains explicit owner/id production fixture evidence. Omitted `id` remains a diagnosed safe no-op; broader Helper ownership remains Partial. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| ReversalDef | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Reversal behavior not implemented. |
| ScreenBound | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Camera/screen bound behavior not implemented. |
| SelfState | Partial 40% | Implemented: Returns a borrowed player to `selfStateOwnerId` and executes that owner's CNS document. Helper/animation ownership remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| SndPan | Partial 75% | Implemented: No occurrence in the three-character Issue #37 set; focused owner/channel/panner tests remain the evidence. Exact WinMUGEN pixel mapping and Helper ownership remain Partial. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| SprPriority | Partial 50% | Implemented: Stores priority field only. Rendering priority needs audit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| StateTypeSet | Complete | Basic implementation exists. |
| StopSnd | Partial 80% | Implemented: Issue #37 confirms real T-H-M-A usage; focused owner/channel tests remain the behavior evidence. Omitted channel and advanced Helper ownership remain Partial. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| SuperPause | Partial 80% | Implemented: Issue #35: production CNS starts a distinct match-level superpause with `darken`/`movetime`, freezes CNS/physics/timers, gates Explods by `supermovetime`, and is tested with bundled T-H-M-A State 3010. Same-pass ordering, Helpers, and full visual semantics remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| TargetBind | Partial 55% | Implemented: Selects registered targets by optional HitDef id, applies `pos` immediately, and stores time/offset metadata. Following-frame bind maintenance and full coordinate semantics remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| TargetDrop | Partial 65% | Implemented: Removes registered targets selected by optional HitDef id; later controllers safely see no target. `excludeid` and Helper/multi-player behavior remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| TargetFacing | Partial 60% | Implemented: Applies facing relative to the target owner for registered targets selected by optional HitDef id. Helper/multi-player behavior remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| TargetLifeAdd | Partial 60% | Implemented: Adds and clamps life on registered targets selected by optional HitDef id. Secondary `kill`/absolute semantics remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| TargetPowerAdd | Partial 65% | Implemented: Adds and clamps Power to the registered target's character-specific `powerMax`, selected by optional HitDef id, through the shared mutator. Missing: Helper/multi-player target ownership and remaining WinMUGEN semantics. Evidence: Issue #52 runtime path and focused tests. |
| TargetState | Partial 55% | Implemented: Enters the requested State with the controller owner's CNS document; SelfState returns to the target owner. Helper/multi-player and animation ownership remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| TargetVelAdd | Partial 65% | Implemented: Adds evaluated X/Y velocity to registered targets selected by optional HitDef id. Helper/multi-player behavior remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| TargetVelSet | Partial 65% | Implemented: Sets evaluated X/Y velocity on registered targets selected by optional HitDef id. Helper/multi-player behavior remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| Trans | Partial 70% | Implemented: Stores transparency mode only. Rendering needs audit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| Turn | Complete | Flips facing. |
| VarAdd | Complete | Basic implementation exists. |
| VarRandom | Partial 40% | Implemented: Deterministic midpoint placeholder. True RNG/range semantics incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| VarRangeSet | Partial 40% | Implemented: Basic integer var range set exists. Full syntax incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| VarSet | Complete | Basic implementation exists. |
| VelAdd | Complete | X values are facing-relative and converted once to world velocity. |
| VelMul | Complete | Multiplies the stored world velocity without reapplying facing. |
| VelSet | Complete | X values are facing-relative; positive X moves forward for either facing. |
| Width | Partial 25% | Implemented: Stores width fields only. Collision integration needs audit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| Zoom | Safe no-op | Recognized by the runtime without changing game state. Recognized safe no-op. Camera zoom not implemented. |

## HitDef Auxiliary Parameter Compatibility

| Parameter | Status | Notes |
|---|---|---|
| affectteam | Not started | Parsed as controller data but not used by live target eligibility. |
| air.fall | Not started | Separate air-fall override is not applied; the basic fall flag remains Partial. |
| air.hittime | Partial 40% | Implemented: Selects airborne hit-stun time at contact; advanced air recovery branches remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| air.type | Partial 40% | Implemented: Snapshotted into GetHitVar and reaction selection; uncommon branches remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| air.velocity | Partial 55% | Implemented: Applies airborne reaction velocity with Facing conversion; projectile parity remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| airground.velocity | Not started | Legacy air-to-ground velocity override is not applied. |
| airguard.velocity | Not started | Legacy air-guard alias is not applied; `guard.velocity` is the connected path. |
| animtype | Partial 55% | Implemented: Light/Medium/Hard ground reactions are connected; Back/Up/DiagUp and missing animation behavior remain Partial. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| attr | Partial 40% | Implemented: Normalized State/attack categories drive HitBy/NotHitBy/HitDefAttr; throw/projectile edges remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| damage | Partial 40% | Implemented: Normal and guarded values reach live contact with KO rules; scaling/projectile parity remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| down.hittime | Complete | Implemented: Issue #61 selects lying-hit hit-stun/slide time only when StateType=L; it no longer incorrectly schedules get-up. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| down.velocity | Complete | Implemented: Issue #61 selects lying-hit X/Y velocity, defaults it to air.velocity, and routes zero-Y slide versus nonzero-Y launch through State 5080. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| down.bounce | Complete | Implemented: Issue #61 selects no-bounce fall.yvel=0 or one-bounce fall velocity for a launched lying target. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| envshake.ampl | Partial 40% | Implemented: Stored in the accepted-contact shake envelope and Canvas feedback. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| envshake.freq | Partial 40% | Implemented: Stored in the accepted-contact shake envelope and Canvas feedback. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| envshake.phase | Partial 40% | Implemented: Stored in the accepted-contact shake envelope and Canvas feedback. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| envshake.time | Partial 40% | Implemented: Starts accepted-contact Canvas shake; fight-wide effect parity remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| fall | Partial 55% | Implemented: Drives common air-fall routing and GetHitVar, including grounded launch hits that continue through 5050/5100/5110/5120 instead of fallback State 0 recovery. Advanced variants remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: focused State 215-style ground launch regression tests. |
| fall.animtype | Partial 40% | Implemented: Snapshotted and diagnosed; full fall animation selection remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| fall.recover | Partial 55% | Implemented: Controls common air recovery eligibility; recovery command input is still required by common CNS before 5200/5210. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: focused State 215-style ground launch regression tests. |
| fall.recovertime | Partial 55% | Implemented: Controls common air recovery timing and blocks recovery command before the configured frame. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: focused State 215-style ground launch regression tests. |
| ground.hittime | Partial 40% | Implemented: Selects grounded hit-stun time; advanced common reactions remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| ground.slidetime | Partial 40% | Implemented: Snapshotted into GetHitVar; complete sliding semantics remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| ground.type | Partial 40% | Implemented: Snapshotted into GetHitVar/reaction metadata; uncommon branches remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| ground.velocity | Partial 55% | Implemented: Applies grounded reaction velocity with Facing conversion. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| groundguard.velocity | Not started | Legacy ground-guard alias is not applied; `guard.velocity` is the connected path. |
| guard.ctrltime | Partial 40% | Implemented: Delays control restoration on live guard routes. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| guard.dist | Partial 40% | Implemented: Gates guard intent by attacker/target center distance; width/camera precision remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| guard.hittime | Partial 40% | Implemented: Selects live guard stun time. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| kill | Partial 40% | Implemented: Normal contact honors 0 by clamping the defender to one Life and honors 1/default by permitting KO. Projectile parity remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| guard.kill | Partial 40% | Implemented: Guard contact independently clamps chip damage at one Life when 0. Projectile parity remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| guard.pausetime | Partial 55% | Implemented: Applies separate attacker/defender guard pause counters. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| guard.slidetime | Not started | Guard slide timing is not independently applied. |
| guard.sparkno | Partial 55% | Implemented: Guard contact creates one shared Explod effect. `S` scope uses attacker AIR/SFF; common/`F` scope requires fightfx assets and is diagnosed when absent. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| guard.sparkxy | Not started | Legacy guard-only spark offset is not applied; common `sparkxy` is connected. |
| guard.velocity | Partial 55% | Implemented: Applies live guard recoil with Facing conversion. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| guardflag | Partial 40% | Implemented: Selects standing/crouching/air guard eligibility. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| guardpausetime | Not started | Unprefixed legacy alias is not applied; `guard.pausetime` is connected. |
| guardsound | Partial 40% | Implemented: Guard contact creates one shared SoundPlayEvent. `S` scope resolves attacker SND through Browser Audio; Issue #51 starts normal game frames only after the Audio Start Gate confirms a running context. Common/`F` scope requires a common SND archive. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: focused AudioStartGate/SoundRuntimeBridge test and runtime inventory. |
| hitflag | Partial 55% | Implemented: H/L/M/A/F/D target classes are connected; `+`/`-` modifiers remain unsupported. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| hitsound | Partial 40% | Implemented: Normal hit creates one shared SoundPlayEvent. `S` scope resolves attacker SND through Browser Audio; Issue #51 starts normal game frames only after the Audio Start Gate confirms a running context. Common/`F` scope requires a common SND archive. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: focused AudioStartGate/SoundRuntimeBridge test and runtime inventory. |
| fall.kill | Partial 40% | Implemented: Snapshotted into GetHitVar and honored by common-State HitFallDamage independently of normal/guard kill. Projectile parity remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| getpower | Partial 60% | Implemented: Explicit hit/guard values apply once to the attacker and clamp to that character's `powerMax`; duplicate contact does not reapply. Missing: `mugen.cfg`-derived omitted defaults and Helper ownership. Evidence: Issue #52 focused hit/guard/duplicate/9000-limit tests and `raw.hit_power`. |
| givepower | Partial 60% | Implemented: Explicit hit/guard values apply once to the defender and clamp to that character's `powerMax`; duplicate contact does not reapply. Missing: `mugen.cfg`-derived omitted defaults and Helper ownership. Evidence: Issue #52 focused hit/guard/duplicate/9000-limit tests and `raw.hit_power`. |
| numhits | Partial 40% | Implemented: Adds the configured value to defender combo/GetHitVar(hitcount) once while attacker HitCount remains one per accepted target contact. Team display semantics remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| ground.cornerpush.veloff | Fallback 40% | Implemented: Applies Facing-relative attacker X velocity only when a grounded target is at the fallback stage boundary. Camera-relative boundaries remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| air.cornerpush.veloff | Fallback 40% | Implemented: Applies Facing-relative attacker X velocity only when an airborne target is at the fallback stage boundary. Camera-relative boundaries remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| down.cornerpush.veloff | Fallback 40% | Implemented: Applies Facing-relative attacker X velocity only when a down target is at the fallback stage boundary. Camera-relative boundaries remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| guard.cornerpush.veloff | Fallback 40% | Implemented: Applies Facing-relative attacker X velocity only for grounded guard at the fallback stage boundary. Camera-relative boundaries remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| airguard.cornerpush.veloff | Fallback 40% | Implemented: Applies Facing-relative attacker X velocity only for air guard at the fallback stage boundary. Camera-relative boundaries remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| snap | Partial 55% | Implemented: Sets target X/Y from attacker position with X transformed by attacker Facing. Stage/camera clamping occurs in the existing later stage pass. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| p1sprpriority | Partial 55% | Implemented: Applies attacker runtime sprite priority on accepted hit or guard; Canvas draws higher priority later. Projectile/effect layering remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| p2sprpriority | Partial 55% | Implemented: Applies defender runtime sprite priority on accepted hit or guard; Canvas draws higher priority later. Projectile/effect layering remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| p1facing | Not started | HitDef-specific attacker Facing override is not applied. |
| p1stateno | Partial 40% | Implemented: Enters attacker-owned custom State on accepted contact. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| p2facing | Not started | HitDef-specific defender Facing override is not applied. |
| palfx.add | Not started | HitDef defender palette add effect is not applied. |
| palfx.time | Not started | HitDef defender palette effect duration is not applied. |
| pausemovetime | Not started | HitDef-specific pause move-time override is not applied. |
| pausetime | Partial 55% | Implemented: Applies separate attacker/defender hit-pause counters. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| priority | Partial 55% | Implemented: Numeric priority and Hit/Miss/Dodge equal-clash behavior are connected; mixed-type edges remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| sparkno | Partial 55% | Implemented: Normal hit creates one shared Explod effect at an explicit absolute stage-space point. `S` scope uses attacker AIR/SFF; common/`F` scope requires fightfx assets and is diagnosed when absent. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| sparkxy | Partial 55% | Implemented: Issue #49 resolves X from P2's P1-facing ground/air `Size` edge and Y from P1's axis, matching WinMUGEN. The shared Explod path does not reapply owner position, camera, AIR offset, or SFF axis. Missing: broader multi-character/fightfx and camera integration remains incomplete. Evidence: focused normal/guard, air, both Facing, nonzero root/camera, offset, scale, and idempotence tests. |
| supermovetime | Not started | HitDef-specific super-pause move-time override is not applied. |
| yaccel | Partial 40% | Implemented: Snapshotted into GetHitVar for common air reaction logic. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |

## Trigger Compatibility

| Trigger | Status | Notes |
|---|---|---|
| Abs | Complete | `Abs(...)` supported for numeric expressions. |
| ACos | Complete | Numeric math function supported in runtime trigger evaluator. |
| AILevel | Complete | Basic trigger support with default 0. |
| Alive | Complete | Basic support. |
| Anim | Complete | Numeric comparison. |
| AnimElem | Complete | Uses 1-based AIR element starts, including repeated starts after LoopStart/default loops; legacy comparison-time syntax and invalid-element false are focused-tested. |
| AnimElemNo | Partial 55% | Implemented: Uses runtime animation element lookup when provided; AIR timing edge cases still need audit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| AnimElemTime | Complete | Uses the AIR element-relative timeline shared with AnimElem, with positive, negative, and invalid-element focused coverage. |
| AnimExist | Partial 55% | Implemented: Evaluates through runtime animation lookup when provided; AIR ownership edge cases still need audit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| AnimTime | Complete | Uses MUGEN-style animation duration helper. |
| ASin | Complete | Numeric math function supported in runtime trigger evaluator. |
| ATan | Complete | Numeric math function supported in runtime trigger evaluator. |
| AuthorName | Partial 40% | Implemented: String source exists; metadata currently defaults empty. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| BackEdge | Not started | Screen/camera edge value not implemented. |
| BackEdgeBodyDist | Fallback 40% | Implemented: Uses fixed fallback stage bounds and player center; camera/body-width precision remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| BackEdgeDist | Fallback 40% | Implemented: Uses internal screen/player coordinate approximation. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| BodyDist X | Partial 40% | Implemented: Evaluates opponent center distance like P2BodyDist X; precise body edge width is still incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| BodyDist Y | Partial 40% | Implemented: Evaluates opponent/player Y coordinate difference like P2BodyDist Y; precise body edge height is still incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| CanRecover | Partial 65% | Implemented: Reads fall.recover and fall.recovertime during the common air-fall path; focused tests verify that 5200/5210 require both CanRecover and `Command = "recovery"`. Broader recovery command/state behavior remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: focused State 215-style ground launch regression tests. |
| Ceil | Complete | `Ceil(...)` supported for numeric expressions. |
| Command | Complete | Basic command set matching. |
| Cond | Complete | Numeric conditional function supported in runtime trigger evaluator. |
| Const | Partial 65% | Implemented: Current-character `[Data]`, `[Size]`, `[Velocity]`, and `[Movement]` values resolve through the intended CNS path; jump/run-jump pairs and yaccel have production-loader coverage. Missing: remaining constant families and coordinate scaling. Evidence: focused expression/runtime tests and bundled T-H-M-A loading. |
| Cos | Complete | Numeric math function supported in runtime trigger evaluator. |
| Ctrl | Complete | Bare boolean and numeric `Ctrl = 1` / `Ctrl = 0` comparisons are covered, including a bundled real-character State -1 route. |
| DrawGame | Partial 70% | Implemented: Reads the live RoundState draw result, including simultaneous KO and equal-Life time over. Missing: team modes and full match-series semantics. Evidence: focused simultaneous-KO and time-over RoundState tests. |
| E | Complete | Numeric math constant supported in runtime trigger evaluator. |
| Exp | Complete | Numeric math function supported in runtime trigger evaluator. |
| Facing | Complete | Numeric comparison. |
| Floor | Complete | `Floor(...)` supported for numeric expressions. |
| FrontEdge | Not started | Screen/camera edge value not implemented. |
| FrontEdgeBodyDist | Fallback 40% | Implemented: Uses fixed fallback stage bounds and player center; camera/body-width precision remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| FrontEdgeDist | Fallback 40% | Implemented: Uses internal screen/player coordinate approximation. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| FVar | Partial 40% | Implemented: `fvar(n)` lookup supported with default 0. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| GameTime | Partial 55% | Implemented: App runtime synchronizes its monotonic tick into `GameState.frame`, so real-game triggers and Explod lifecycle no longer remain at frame 0. Pause/round exact WinMUGEN boundaries still need broader verification. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| GetHitVar | Partial 80% | Implemented: Contact snapshot supplies damage, hit/slide/control time, velocity, type/anim codes, fall damage/kill, combo hitcount, snap xoff/yoff, ids, guarded, and yaccel across get-hit State changes. yvel selects ground.velocity.y for S/C contact and air.velocity.y for A; fall.yvelocity remains separate, and numeric fall terms have boolean truthiness. Unsupported zoff/fall-time keys are diagnosed safe defaults. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| HitCount | Partial 75% | Implemented: Counts accepted hits across ActiveHitDef generations; `hitcountpersist` independently preserves or resets it on State entry. UniqHitCount and full multi-target semantics remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| HitDefAttr | Partial 40% | Implemented: Compares State and attack categories against the same normalized attr snapshot used by live HitBy/NotHitBy filtering. Redirect and malformed-attr edge cases remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| HitFall | Partial 55% | Implemented: Reads the contact-snapshotted HitDef fall flag through common air get-hit states. Guard/projectile parity remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| HitOver | Partial 75% | Implemented: Reads the independent selected hit-time clock used by common get-hit state routing. Missing: uncommon recovery and custom-state timing semantics. Evidence: common get-hit runtime integration tests. |
| HitPauseTime | Complete | Reads player hitPause. |
| HitShakeOver | Partial 75% | Implemented: Becomes true when the defender hit-pause counter expires. Missing: uncommon pause interaction and Helper semantics. Evidence: hit-pause and common get-hit runtime integration tests. |
| HitVel X | Partial 40% | Implemented: Optional hit velocity field, default 0. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| HitVel Y | Partial 40% | Implemented: Optional hit velocity field, default 0. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| ID | Not started | Player/helper id trigger not implemented. |
| IfElse | Complete | Numeric conditional function supported in runtime trigger evaluator. |
| InGuardDist | Fallback 40% | Implemented: Simple distance approximation. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| IsHelper | Partial 60% | Implemented: Returns 1 while evaluating a Helper entity and 0 for root players in the Phase1 runtime. Missing: redirect/custom-state and non-player entity audit. Evidence: focused root/helper trigger test. |
| IsHomeTeam | Not started | Team metadata not implemented. |
| Life | Complete | Numeric comparison. |
| LifeMax | Partial 40% | Implemented: Default 1000. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| Ln | Complete | Numeric math function supported in runtime trigger evaluator. |
| Log | Complete | Numeric math function supported in runtime trigger evaluator. |
| Lose | Partial 70% | Implemented: Reads the live RoundState loser for P1/P2 after KO or time over. Missing: team/helper ownership and full match-series semantics. Evidence: focused P1/P2 KO RoundState and trigger-context tests. |
| LoseKO | Not started | Round result not implemented. |
| LoseTime | Not started | Round result not implemented. |
| MatchNo | Not started | Match metadata not implemented. |
| MatchOver | Partial 75% | Implemented: Becomes true for the live KO/time-over round phase and drives common State 5150's match-over animation. Missing: full match-series and team-mode rules. Evidence: focused State 5150 MatchOver animation and RoundState tests. |
| MoveContact | Partial 80% | Implemented: Reads real hit or guarded contact state for the current ActiveHitDef generation; `movehitpersist` independently preserves or resets result flags on State entry. MoveReversed/team semantics remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| MoveGuarded | Partial 75% | Implemented: Guardflag-approved live contact sets guarded without setting MoveHit; persist headers remain incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| MoveHit | Partial 85% | Implemented: Reads accepted-hit state and drives tested hit-confirm cancel routes, including Issue #65 repeated-trigger target redirect integration. Missing: Helper/projectile parity and broader WinMUGEN lifetime cases. Evidence: focused MoveContact, live HitDef, and bundled T-H-M-A State 1015 tests. |
| MoveReversed | Not started | Reversal/contact state not implemented. |
| MoveType | Complete | Basic support. |
| Name | Partial 40% | Implemented: String source exists; metadata defaults empty. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| NumEnemy | Safe no-op | Recognized by the runtime without changing game state. Safe default 1. |
| NumExplod | Safe no-op | Recognized by the runtime without changing game state. Production Explod entries now exist, but this trigger still returns safe default 0; owner plus optional MUGEN id lookup remains unconnected. |
| NumHelper | Partial 65% | Implemented: Counts current committed Helpers for the evaluating entity's root and optionally filters duplicate-capable MUGEN Helper IDs. Spawn requests become visible at the frame commit point. Missing: redirect/team/custom-state edge audit. Evidence: focused count, duplicate ID, P1/P2, and nested Helper tests. |
| NumPartner | Safe no-op | Recognized by the runtime without changing game state. Safe default 0. |
| NumProj | Safe no-op | Recognized by the runtime without changing game state. Safe default 0. |
| NumProjID | Safe no-op | Recognized by the runtime without changing game state. Safe default 0. |
| NumTarget | Partial 60% | Implemented: Counts registered HitDef targets with optional HitDef id filtering; Helper/multi-player lookup remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| TargetID | Partial 55% | Implemented: Returns the first registered target player id, optionally filtered by HitDef id. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| TargetStateNo | Partial 55% | Implemented: Returns current StateNo for the selected two-player target; Helper/multi-player lookup remains incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| P1Name | Not started | Alias not implemented. `Name` exists. |
| P2BodyDist X | Partial 40% | Implemented: Uses opponent/player coordinate difference. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| P2BodyDist Y | Partial 40% | Implemented: Uses opponent/player coordinate difference. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| P2Dist X | Partial 40% | Implemented: Uses opponent/player coordinate difference. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| P2Dist Y | Partial 40% | Implemented: Uses opponent/player coordinate difference. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| P2Life | Partial 40% | Implemented: Uses opponent life or default. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| P2MoveType | Partial 40% | Implemented: Opponent move type supported. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| P2Name | Partial 40% | Implemented: Opponent metadata source exists, default empty. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| P2StateNo | Partial 40% | Implemented: Opponent stateNo supported. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| P2StateType | Partial 40% | Implemented: Opponent state type supported. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| P3Name | Not started | Team metadata not implemented. |
| P4Name | Not started | Team metadata not implemented. |
| PalNo | Not started | Palette slot trigger not implemented. |
| ParentDist X | Not started | Parent distance not implemented. |
| ParentDist Y | Not started | Parent distance not implemented. |
| Pi | Complete | Numeric math constant supported in runtime trigger evaluator. |
| PlayerIDExist | Not started | Player/helper lookup by id not implemented. |
| Pos X | Complete | Basic X comparison. |
| Pos Y | Complete | Basic Y comparison. |
| Power | Partial 80% | Implemented: Reads the evaluated P1/P2 player's durable value; threshold command routes, state preservation, consumption, independence, and round reset are focused-tested. Missing: Helper/root redirect ownership pending Issue #58. Evidence: Issue #52 focused runtime tests and `raw.power`. |
| PowerMax | Partial 80% | Implemented: Reads each P1/P2 player's `[Data] power`-derived maximum (default 3000), including bundled 9000-limit characters. Missing: Helper/root redirect ownership pending Issue #58. Evidence: Issue #52 loader/runtime tests and HUD integration. |
| PrevStateNo | Partial 80% | Implemented: Records the immediate source on State entry, re-entry, and multiple same-frame transitions; round reset has no stale value. Missing: Helper/custom-state ownership and broader real-character audit. Evidence: Issue #65 focused and bundled T-H-M-A integration tests. |
| ProjCancelTime | Safe no-op | Recognized by the runtime without changing game state. Safe default -1. |
| ProjContact | Not started | Boolean projectile contact not implemented. |
| ProjContactTime | Safe no-op | Recognized by the runtime without changing game state. Safe default -1. |
| ProjGuarded | Not started | Boolean projectile guarded not implemented. |
| ProjGuardedTime | Safe no-op | Recognized by the runtime without changing game state. Safe default -1. |
| ProjHit | Not started | Boolean projectile hit not implemented. |
| ProjHitTime | Safe no-op | Recognized by the runtime without changing game state. Safe default -1. |
| Random | Partial 40% | Implemented: Deterministic placeholder 500. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| RootDist X | Not started | Root distance not implemented. |
| RootDist Y | Not started | Root distance not implemented. |
| RoundNo | Partial 40% | Implemented: Context/default support. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| RoundsExisted | Safe no-op | Recognized by the runtime without changing game state. Safe default true. |
| RoundState | Complete | Basic support with default 2 unless supplied. |
| ScreenPos X | Fallback 40% | Implemented: Uses internal position approximation. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| ScreenPos Y | Fallback 40% | Implemented: Uses internal position approximation. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| SelfAnimExist | Partial 55% | Implemented: Evaluates through runtime self-animation lookup when provided; redirect-specific AIR ownership still needs audit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| Sin | Complete | Numeric math function supported in runtime trigger evaluator. |
| StateNo | Complete | Numeric comparison. |
| StateTime | Partial 55% | Implemented: Real-character compatibility alias reads the same current State time as `Time`; WinMUGEN-version provenance remains under audit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| StateType | Complete | Basic support. |
| SysFVar | Not started | System float vars not implemented. |
| SysVar | Complete | Basic numeric comparison. |
| Tan | Complete | Numeric math function supported in runtime trigger evaluator. |
| TeamMode | Not started | Team mode not implemented. |
| TeamSide | Fallback 40% | Implemented: Context/player id fallback. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| TicksPerSecond | Complete | Constant 60. |
| Time | Complete | State time comparison. |
| TimeMod | Partial 40% | Implemented: Evaluates State time modulo a positive divisor against the requested remainder; invalid divisors fail safely. `%` remains the preferred equivalent. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| UniqHitCount | Not started | Hit counter not implemented. |
| Var | Complete | Basic numeric comparison. |
| Vel X | Complete | Exposes world X velocity relative to the player's facing. |
| Vel Y | Complete | Basic Y velocity comparison. |
| Win | Partial 70% | Implemented: Reads the live RoundState winner for P1/P2 after KO or time over. Missing: team/helper ownership and full match-series semantics. Evidence: focused P1/P2 KO RoundState and trigger-context tests. |
| WinKO | Not started | Round result not implemented. |
| WinPerfect | Not started | Round result not implemented. |
| WinTime | Not started | Round result not implemented. |

## Redirects / Player References

| Redirect | Status | Notes |
|---|---|---|
| enemy | Partial 50% | Implemented: Redirect parser support exists; maps to opponent when present. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| enemynear | Partial 50% | Implemented: Redirect parser support exists; maps to opponent when present. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| helper | Not started | Helper lookup by id/name not implemented. |
| parent | Fallback 40% | Implemented: Safe self fallback for non-helper runtime. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| partner | Not started | Team mode not implemented. |
| root | Fallback 40% | Implemented: Safe self fallback for non-helper runtime. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current approximate behavior, runtime inventory, and focused-test inventory. |
| target | Partial 70% | Implemented: Resolves optional HitDef id through the attacker's live Target registry, evaluates the selected two-player runtime entity, and returns SFalse when absent. Missing: Helper/team/multi-target selection parity and other redirected trigger families. Evidence: Issue #65 positive/negative and bundled T-H-M-A integration tests plus Runtime History diagnostics. |
| playerid | Not started | Player lookup by id not implemented. |

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
| Parentheses | Partial 40% | Implemented: Outer/group parentheses supported; full expression grammar incomplete. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| `+` | Complete | Supported in numeric trigger expressions with tests. |
| `-` | Complete | Binary subtraction supported in numeric trigger expressions with tests. |
| `*` | Complete | Supported in numeric trigger expressions with tests. |
| `/` | Complete | Supported in numeric trigger expressions with tests. Division by zero fails the expression safely. |
| `%` | Complete | Supported in numeric trigger expressions with tests. Modulo by zero fails the expression safely. |
| Unary minus | Partial 40% | Implemented: Supported as numeric literal. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| `var(n)` | Complete | Basic integer var lookup supported. |
| `sysvar(n)` | Complete | Basic system var lookup supported. |
| `fvar(n)` | Partial 40% | Implemented: Float var lookup defaults to 0. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| Redirect expression chain | Partial 65% | Implemented: Parses bare and indexed `enemy`/`enemynear` plus optional HitDef-id `target(ID)` before evaluating numeric or enum child triggers; missing redirect is SFalse. Missing: Helper/parent/root ownership and team/multi-entity selection. Evidence: Issue #65 focused evaluator/runtime diagnostics and integration tests. |

## CMD Compatibility

| Feature | Status | Notes |
|---|---|---|
| Single button commands | Complete | Basic support. |
| Hold direction `/D` | Complete | Basic support. |
| Hold direction `/F` | Complete | Basic support. |
| Hold direction `/B` | Complete | Basic support. |
| Hold direction `/U` | Complete | Basic support. |
| Direction sequences | Partial 40% | Implemented: Facing-relative `~D, DB, B, F, x/y` is verified through the bundled T-H-M-A CMD and State -1 route. Missing: other sequence and charge forms still need WinMUGEN timing/syntax audit. Evidence: focused matcher, resolver, and real-character integration tests. |
| Button sequences | Partial 40% | Implemented: Basic support; simple button commands are kept briefly active so jump/crouch startup routes do not drop the input. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| Simultaneous buttons | Audit needed | Parser and command matcher behavior require syntax and timing verification. |
| Release commands | Partial 40% | Implemented: `~` is retained and requires the matched direction/button to be absent in a newer input frame. Missing: numeric charge and other compound modifier forms. Evidence: positive/negative release tests and bundled T-H-M-A integration. |
| Buffer time | Partial 40% | Implemented: InputBuffer exists; simple button and double-tap direction commands have short default post-match buffering. Double-tap directions no longer retrigger while the second direction is held, but full WinMUGEN timing still needs audit. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| command.time | Partial 60% | Implemented: `time = 25` accepts 24/25-frame sequences and rejects 26 frames in the production matcher. Missing: broader WinMUGEN timing/pause audit. Evidence: focused 24/25/26-frame matcher tests. |
| command.buffer.time | Partial 50% | Implemented: Parser and command matcher honor explicit buffer.time as a post-match active window; default buffering covers simple buttons and double-tap directions after release, but WinMUGEN timing audit still needed. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| `$` direction match | Partial 40% | Implemented: KFM hold commands work; full syntax needs tests. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| `/` hold prefix | Partial 40% | Implemented: Used in common commands. Needs syntax coverage. Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory. |
| `+` simultaneous input | Audit needed | Parser and command matcher behavior require WinMUGEN timing and syntax verification. |
