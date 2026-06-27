# WebMUGEN WinMUGEN Compatibility Matrix

Updated: 2026-06-28

This document is the working compatibility checklist for WebMUGEN. Status is intentionally conservative: **Complete** requires either focused tests or a confirmed app integration path. Runtime shims that only recognize a controller or preserve safe no-op behavior are marked **Partial**, not Complete.

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

## StateDef Compatibility

| StateNo / Range | WinMUGEN Meaning | Status | Notes |
|---:|---|---|---|
| -3 | Global state | Unsupported | Runtime currently handles -1/-2. -3 should be added. |
| -2 | Global state | Partial | `stepCnsStateRuntime` handles -2. Coverage incomplete. |
| -1 | Command state | Partial | Used for CMD routing. Broader trigger support was added. |
| 0 | Stand | Complete | Common baseline and idle fallback exist. |
| 10 | Crouch start | Partial | Common route exists. Runtime validation ongoing. |
| 11 | Crouching | Partial | Common route exists. |
| 12 | Crouch end | Partial | Common route exists. |
| 20 | Walk forward | Partial | Common route exists. Debugging ongoing. |
| 21 | Walk back | Partial | Added as common back-walk state. |
| 40 | Jump start | Partial | Common route exists. Jump velocity is minimal. |
| 41 | Character-defined jump variant | Untested | KFM can define this. Not common-guaranteed. |
| 42 | Character-defined jump variant | Untested | Common implementations may vary. |
| 45 | Air jump / jump transition variant | Unsupported | Needs WinMUGEN/common1 verification. |
| 50 | Jump up | Partial | Common baseline exists. Air physics incomplete. |
| 51 | Jump down | Unsupported | Needed for more accurate air-state sequencing. |
| 52 | Jump land | Partial | Common baseline exists. Landing logic under active work. |
| 100 | Run / dash forward | Partial | Common route added with PosAdd. Needs true velocity/friction behavior. |
| 101-104 | Run / dash substates | Untested | Common implementations vary. |
| 105 | Hop back / back dash | Partial | Common route added with PosAdd. |
| 106-107 | Back dash substates | Untested | Common implementations vary. |
| 120 | Guard start | Unsupported | Required for basic defense. |
| 130 | Standing guard | Unsupported | Required for basic defense. |
| 131 | Crouching guard | Unsupported | Required for basic defense. |
| 132 | Air guard | Unsupported | Required for basic defense. |
| 140-155 | Guard hit / guard recoil states | Unsupported | Required for blocking. |
| 170-181 | Lose / win states | Unsupported | Round flow only partially implemented. |
| 190-199 | Intro states | Unsupported | Round intro not implemented. |
| 5000-5210 | Common get-hit / fall / recovery states | Unsupported | Required for hit reactions and knockdown. |
| 5300+ | Character/system/custom states | Untested | Open-ended. Track per character. |
| 800-899 | Throw states by convention | Untested | KFM uses command routes in this range. |
| 1000+ | Specials/projectiles/helpers by convention | Untested | Character-specific. |

## StateDef Header Fields

| Field | Purpose | Status | Notes |
|---|---|---|---|
| type | State type: S/C/A/L | Complete | Parsed and applied. |
| movetype | I/A/H | Complete | Parsed and applied. |
| physics | S/C/A/N | Partial | Parsed and applied. Physics behavior incomplete. |
| anim | Initial animation | Complete | Parsed and applied. Animless state preservation exists. |
| ctrl | Control flag | Complete | Parsed and applied. |
| poweradd | Power gain on state entry | Unsupported | Need parser/runtime support. |
| juggle | Juggle points | Unsupported | Needed for hit system compatibility. |
| facep2 | Face opponent on state entry | Unsupported | Needed for many attacks. |
| hitdefpersist | Keep HitDef on state change | Unsupported | Hit system compatibility. |
| movehitpersist | Keep MoveHit info | Unsupported | Hit system compatibility. |
| hitcountpersist | Keep hit count | Unsupported | Hit system compatibility. |
| sprpriority | Sprite priority | Partial | Runtime field exists; rendering needs audit. |

## State Controller Compatibility

Each State Controller is listed on its own row. **Partial** means the controller is now recognized by runtime and will not silently disappear as unknown, but full WinMUGEN side effects may still be missing.

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
| ChangeAnim | Complete | Basic implementation exists. |
| ChangeAnim2 | Partial | Recognized safe no-op. Target/common animation behavior not implemented. |
| ChangeState | Complete | Basic implementation exists and state entry is centralized. |
| ClearClipboard | Partial | Recognized safe no-op. Debug clipboard not implemented. |
| CtrlSet | Complete | Basic implementation exists. |
| DefenceMulSet | Partial | Stores defense multiplier field only. |
| DestroySelf | Partial | Recognized safe no-op. Helper destruction not implemented. |
| DisplayToClipboard | Partial | Recognized safe no-op. Debug clipboard not implemented. |
| EnvColor | Partial | Recognized safe no-op. Screen color flash not implemented. |
| EnvShake | Partial | Recognized safe no-op. Screen shake not implemented. |
| Explod | Partial | Recognized safe no-op in CNS runtime; Explod system exists separately. |
| ExplodBindTime | Partial | Recognized safe no-op. Explod binding not implemented here. |
| ForceFeedback | Partial | Recognized safe no-op. Input device feedback not implemented. |
| GameMakeAnim | Partial | Recognized safe no-op. Global animation effect not implemented. |
| Gravity | Partial | Recognized safe no-op. Physics layer applies gravity separately. |
| Helper | Partial | Recognized safe no-op in CNS runtime; Helper system exists separately. |
| HitAdd | Partial | Stores hit count field only. |
| HitBy | Partial | Stores allowed-hit attribute string only. |
| HitDef | Partial | Recognized safe no-op in CNS runtime; HitDef parser/runtime exists separately. |
| HitFallDamage | Partial | Applies simple life reduction. Full fall damage semantics incomplete. |
| HitFallSet | Partial | Recognized safe no-op. Fall flags not implemented. |
| HitFallVel | Partial | Applies simple Y velocity. Full get-hit semantics incomplete. |
| HitOverride | Partial | Recognized safe no-op. Override table not implemented. |
| HitVelSet | Partial | Applies simple velocity set. Full get-hit semantics incomplete. |
| LifeAdd | Complete | Basic implementation exists. |
| LifeSet | Complete | Basic implementation exists. |
| MakeDust | Partial | Recognized safe no-op. Dust rendering not implemented. |
| ModifyExplod | Partial | Recognized safe no-op. Explod mutation not implemented here. |
| MoveHitReset | Partial | Recognized safe no-op. Move contact reset incomplete. |
| MoveTypeSet | Complete | Basic implementation exists. |
| NotHitBy | Partial | Stores not-hit attribute string only. |
| Null | Complete | Explicit no-op. |
| Offset | Partial | Stores draw offset field only. Rendering needs audit. |
| PalFX | Partial | Recognized safe no-op. Palette effect not implemented. |
| ParentVarAdd | Partial | Recognized safe no-op. Parent var lookup not implemented. |
| ParentVarSet | Partial | Recognized safe no-op. Parent var lookup not implemented. |
| Pause | Partial | Stores pause time field only. Full pause effect handled elsewhere/incomplete. |
| PlayerPush | Partial | Stores player push flag only. Collision push integration needs audit. |
| PlaySnd | Partial | Recognized safe no-op. Sound playback not implemented. |
| PosAdd | Complete | Basic implementation exists. |
| PosFreeze | Partial | Recognized safe no-op. Freeze behavior not implemented. |
| PosSet | Complete | Basic implementation exists. |
| PowerAdd | Complete | Basic implementation exists. |
| PowerSet | Complete | Basic implementation exists. |
| Projectile | Partial | Recognized safe no-op in CNS runtime; Projectile system exists separately. |
| RemoveExplod | Partial | Recognized safe no-op. Explod removal not implemented here. |
| ReversalDef | Partial | Recognized safe no-op. Reversal behavior not implemented. |
| ScreenBound | Partial | Recognized safe no-op. Camera/screen bound behavior not implemented. |
| SelfState | Partial | Basic state entry exists. Full custom-state ownership semantics incomplete. |
| SndPan | Partial | Recognized safe no-op. Sound pan not implemented. |
| SprPriority | Partial | Stores priority field only. Rendering priority needs audit. |
| StateTypeSet | Complete | Basic implementation exists. |
| StopSnd | Partial | Recognized safe no-op. Sound stopping not implemented. |
| SuperPause | Partial | Stores super pause time field only. Full superpause behavior incomplete. |
| TargetBind | Partial | Recognized safe no-op. Target binding not implemented. |
| TargetDrop | Partial | Recognized safe no-op. Target list not implemented. |
| TargetFacing | Partial | Recognized safe no-op. Target mutation not implemented. |
| TargetLifeAdd | Partial | Recognized safe no-op. Target mutation not implemented. |
| TargetPowerAdd | Partial | Recognized safe no-op. Target mutation not implemented. |
| TargetState | Partial | Recognized safe no-op. Target custom state transition not implemented. |
| TargetVelAdd | Partial | Recognized safe no-op. Target velocity mutation not implemented. |
| TargetVelSet | Partial | Recognized safe no-op. Target velocity mutation not implemented. |
| Trans | Partial | Stores transparency mode only. Rendering needs audit. |
| Turn | Complete | Flips facing. |
| VarAdd | Complete | Basic implementation exists. |
| VarRandom | Partial | Deterministic midpoint placeholder. True RNG/range semantics incomplete. |
| VarRangeSet | Partial | Basic integer var range set exists. Full syntax incomplete. |
| VarSet | Complete | Basic implementation exists. |
| VelAdd | Complete | Basic implementation exists. |
| VelMul | Complete | Basic implementation exists. |
| VelSet | Complete | Basic implementation exists. |
| Width | Partial | Stores width fields only. Collision integration needs audit. |
| Zoom | Partial | Recognized safe no-op. Camera zoom not implemented. |

## Trigger Compatibility

| Trigger | Status | Notes |
|---|---|---|
| Abs | Complete | `Abs(...)` supported for numeric expressions. |
| ACos | Unsupported | Math function not implemented. |
| AILevel | Complete | Basic trigger support with default 0. |
| Alive | Complete | Basic support. |
| Anim | Complete | Numeric comparison. |
| AnimElem | Complete | Simplified approximation. |
| AnimElemNo | Unsupported | Needs animation element resolver. |
| AnimElemTime | Complete | Simplified approximation. |
| AnimExist | Unsupported | Needs AIR lookup. |
| AnimTime | Complete | Uses MUGEN-style animation duration helper. |
| ASin | Unsupported | Math function not implemented. |
| ATan | Unsupported | Math function not implemented. |
| AuthorName | Partial | String source exists; metadata currently defaults empty. |
| BackEdge | Unsupported | Screen/camera edge value not implemented. |
| BackEdgeDist | Partial | Uses internal screen/player coordinate approximation. |
| BodyDist | Unsupported | Body edge distance not implemented. |
| CanRecover | Partial | Safe default currently returns true. |
| Ceil | Complete | `Ceil(...)` supported for numeric expressions. |
| Command | Complete | Basic command set matching. |
| Cond | Unsupported | Expression function not implemented. |
| Const | Partial | Common constants return default approximations. |
| Cos | Unsupported | Math function not implemented. |
| Ctrl | Complete | Basic support. |
| DrawGame | Partial | Safe default false. Round result not implemented. |
| E | Unsupported | Math constant not implemented. |
| Exp | Unsupported | Math function not implemented. |
| Facing | Complete | Numeric comparison. |
| Floor | Complete | `Floor(...)` supported for numeric expressions. |
| FrontEdge | Unsupported | Screen/camera edge value not implemented. |
| FrontEdgeDist | Partial | Uses internal screen/player coordinate approximation. |
| FVar | Partial | `fvar(n)` lookup supported with default 0. |
| GameTime | Partial | Context/player fallback exists; real global frame integration needs audit. |
| GetHitVar | Partial | Common get-hit vars return safe defaults. |
| HitCount | Partial | Safe default 0. |
| HitDefAttr | Unsupported | HitDef attribute checks not implemented. |
| HitFall | Partial | Optional player flag, default false. |
| HitOver | Partial | Safe default true. |
| HitPauseTime | Complete | Reads player hitPause. |
| HitShakeOver | Partial | Safe default true. |
| HitVel | Partial | Optional hit velocity fields, default 0. |
| ID | Unsupported | Player/helper id trigger not implemented. |
| IfElse | Unsupported | Expression function not implemented. |
| InGuardDist | Partial | Simple distance approximation. |
| IsHelper | Partial | Safe default 0. |
| IsHomeTeam | Unsupported | Team metadata not implemented. |
| Life | Complete | Numeric comparison. |
| LifeMax | Partial | Default 1000. |
| Ln | Unsupported | Math function not implemented. |
| Log | Unsupported | Math function not implemented. |
| Lose | Partial | Safe default false. Round result not implemented. |
| LoseKO | Unsupported | Round result not implemented. |
| LoseTime | Unsupported | Round result not implemented. |
| MatchNo | Unsupported | Match metadata not implemented. |
| MatchOver | Unsupported | Match flow not implemented. |
| MoveContact | Partial | Uses activeHitDef/hitDefUsed approximation. |
| MoveGuarded | Partial | Safe default false. |
| MoveHit | Partial | Uses activeHitDef/hitDefUsed approximation. |
| MoveReversed | Unsupported | Reversal/contact state not implemented. |
| MoveType | Complete | Basic support. |
| Name | Partial | String source exists; metadata defaults empty. |
| NumEnemy | Partial | Safe default 1. |
| NumExplod | Partial | Safe default 0. |
| NumHelper | Partial | Safe default 0. |
| NumPartner | Partial | Safe default 0. |
| NumProj | Partial | Safe default 0. |
| NumProjID | Partial | Safe default 0. |
| NumTarget | Partial | Safe default 0. |
| P1Name | Unsupported | Alias not implemented. `Name` exists. |
| P2BodyDist | Partial | Uses opponent/player coordinate difference. |
| P2Dist | Partial | Uses opponent/player coordinate difference. |
| P2Life | Partial | Uses opponent life or default. |
| P2MoveType | Partial | Opponent move type supported. |
| P2Name | Partial | Opponent metadata source exists, default empty. |
| P2StateNo | Partial | Opponent stateNo supported. |
| P2StateType | Partial | Opponent state type supported. |
| P3Name | Unsupported | Team metadata not implemented. |
| P4Name | Unsupported | Team metadata not implemented. |
| PalNo | Unsupported | Palette slot trigger not implemented. |
| ParentDist | Unsupported | Parent distance not implemented. |
| Pi | Unsupported | Math constant not implemented. |
| PlayerIDExist | Unsupported | Player/helper lookup by id not implemented. |
| Pos | Complete | Basic x/y comparison. |
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
| RootDist | Unsupported | Root distance not implemented. |
| RoundNo | Partial | Context/default support. |
| RoundsExisted | Partial | Safe default true. |
| RoundState | Complete | Basic support with default 2 unless supplied. |
| ScreenPos | Partial | Uses internal position approximation. |
| SelfAnimExist | Unsupported | AIR lookup not implemented. |
| Sin | Unsupported | Math function not implemented. |
| StateNo | Complete | Numeric comparison. |
| StateType | Complete | Basic support. |
| SysFVar | Unsupported | System float vars not implemented. |
| SysVar | Complete | Basic numeric comparison. |
| Tan | Unsupported | Math function not implemented. |
| TeamMode | Unsupported | Team mode not implemented. |
| TeamSide | Partial | Context/player id fallback. |
| TicksPerSecond | Complete | Constant 60. |
| Time | Complete | State time comparison. |
| UniqHitCount | Unsupported | Hit counter not implemented. |
| Var | Complete | Basic numeric comparison. |
| Vel | Complete | Basic x/y comparison. |
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
| Numeric comparisons = != > >= < <= | Complete | Simple trigger forms. |
| Range comparisons `= [a,b]` / `!= [a,b]` | Complete | Numeric ranges supported. |
| String equality | Partial | Command, state type, move type, physics, name-like sources. |
| Boolean AND between triggerall and triggerN | Complete | Covered by trigger group evaluator. |
| OR between trigger groups | Complete | Multiple triggerN groups supported. |
| Top-level `&&` / `||` / `!` | Complete | Supported for simple expressions. |
| Parentheses | Partial | Outer/group parentheses supported; full expression grammar incomplete. |
| Arithmetic + - * / % | Unsupported | Needed for broad CNS compatibility. |
| Unary minus | Partial | Supported as numeric literal. |
| Functions | Partial | `Abs`, `Floor`, `Ceil`; trig/log/IfElse/Cond unsupported. |
| Indexed access var(n), sysvar(n), fvar(n) | Partial | var/sysvar basic; fvar default lookup. |
| Redirection expression chains | Partial | `enemynear, stateno` style basic support. |

## CMD Compatibility

| Feature | Status | Notes |
|---|---|---|
| Single button commands | Complete | Basic support. |
| Hold direction `/D`, `/F`, etc. | Complete | Basic support. |
| Direction sequences | Partial | Command matcher exists; needs WinMUGEN timing audit. |
| Button sequences | Partial | Basic support. |
| Simultaneous buttons | Partial | Needs full syntax audit. |
| Release commands | Untested | Check `~` syntax behavior. |
| Buffer time | Partial | InputBuffer exists, timing needs compatibility tests. |
| command.time | Untested | Parser/runtime status needs verification. |
| command.buffer.time | Untested | Parser/runtime status needs verification. |
| `$` 4-way direction match | Partial | KFM hold commands work; full syntax needs tests. |
| `/` hold prefix | Partial | Used in common commands. Needs syntax coverage. |
| `+` simultaneous input | Partial | Needs tests. |

## Current High-Priority Compatibility Gaps

| Priority | Gap | Reason |
|---:|---|---|
| 1 | State -3 execution | Many common systems depend on -3/-2/-1 ordering. |
| 1 | State20/21/10/11/12 runtime validation | Basic movement must be reliable before attacks. |
| 1 | Air physics and State51/52 landing | Jump compatibility depends on this. |
| 1 | Arithmetic expression parser | Many real CNS triggers use arithmetic, not just simple comparisons. |
| 2 | True P2/enemy/target/helper lookup | Current redirect support is mostly safe fallback. |
| 2 | Full State Controller side effects | Every listed controller is recognized, but many are still safe shims. |
| 2 | HitDef runtime completeness | Required for normal attacks and specials. |
| 2 | SelfState / TargetState / custom states | Required for throws and get-hit states. |
| 3 | Explod / Helper controller compatibility | Required for visual effects and projectiles beyond basics. |
| 3 | Sound controllers | Required for presentation compatibility. |
| 3 | PalFX/AfterImage/Trans | Required for visual compatibility. |

## Maintenance Rules

1. Every new controller or trigger implementation should update this file and the HTML matrix in the same commit.
2. Status must not be marked Complete without either a focused unit test or a confirmed app integration path.
3. Partial entries should include what subset is implemented.
4. WinMUGEN-specific deviations from MUGEN 1.0/1.1 docs should be recorded in Notes.
5. Character-specific issues should link to the character file and state number where possible.
