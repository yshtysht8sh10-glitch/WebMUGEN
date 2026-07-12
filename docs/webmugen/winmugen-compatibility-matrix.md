# WebMUGEN WinMUGEN Compatibility Matrix

Updated: 2026-06-28

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
| 120 | Guard start | Unsupported | Required for basic defense. |
| 130 | Standing guard | Unsupported | Required for basic defense. |
| 131 | Crouching guard | Unsupported | Required for basic defense. |
| 132 | Air guard | Unsupported | Required for basic defense. |
| 140 | Guard hit state | Unsupported | Required for blocking. |
| 150 | Guard recoil state | Unsupported | Required for blocking. |
| 151 | Guard recoil state | Unsupported | Required for blocking. |
| 152 | Guard recoil state | Unsupported | Required for blocking. |
| 153 | Guard recoil state | Unsupported | Required for blocking. |
| 154 | Guard recoil state | Unsupported | Required for blocking. |
| 155 | Guard recoil state | Unsupported | Required for blocking. |
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
| 5000 | Common get-hit state | Partial | Fallback standing hit reaction enters State 5000, emits transient hit events, and recovers attack reuse; full WinMUGEN GetHitVar/common1 flow is incomplete. |
| 5001 | Common get-hit state | Unsupported | Required for hit reactions. |
| 5010 | Common get-hit state | Unsupported | Required for hit reactions. |
| 5011 | Common get-hit state | Unsupported | Required for hit reactions. |
| 5020 | Common get-hit state | Unsupported | Required for hit reactions. |
| 5030 | Fall state | Unsupported | Required for knockdown. |
| 5035 | Fall state | Unsupported | Required for knockdown. |
| 5040 | Fall state | Unsupported | Required for knockdown. |
| 5050 | Fall state | Unsupported | Required for knockdown. |
| 5060 | Fall state | Unsupported | Required for knockdown. |
| 5070 | Fall state | Unsupported | Required for knockdown. |
| 5080 | Fall recovery state | Unsupported | Required for recovery. |
| 5090 | Fall recovery state | Unsupported | Required for recovery. |
| 5100 | Down state | Unsupported | Required for knockdown. |
| 5110 | Down state | Unsupported | Required for knockdown. |
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
| ctrl | Control flag | Complete | Parsed and applied. |
| poweradd | Power gain on state entry | Complete | Parsed and applied once when entering a state. |
| juggle | Juggle points | Partial | Parsed and stored on state entry; HitDef/juggle consumption is still incomplete. |
| facep2 | Face opponent on state entry | Complete | Parsed and applied when entering a state; Debug Overlay exposes facing. |
| hitdefpersist | Keep HitDef on state change | Unsupported | Hit system compatibility. |
| movehitpersist | Keep MoveHit info | Unsupported | Hit system compatibility. |
| hitcountpersist | Keep hit count | Unsupported | Hit system compatibility. |
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
| Explod | Partial | Recognized safe no-op in CNS runtime; Explod system exists separately. |
| ExplodBindTime | Partial | Recognized safe no-op. Explod binding not implemented here. |
| ForceFeedback | Partial | Recognized safe no-op. Input device feedback not implemented. |
| GameMakeAnim | Partial | Recognized safe no-op. Global animation effect not implemented. |
| Gravity | Partial | Recognized safe no-op. Physics layer applies gravity separately. |
| Helper | Partial | Recognized safe no-op in CNS runtime; Helper system exists separately. |
| HitAdd | Partial | Stores hit count field only. |
| HitBy | Partial | Stores allowed-hit attribute string only. |
| HitDef | Partial | CNS runtime applies `damage`, `ground.hittime`, `air.hittime`, and grounded Light/Medium/Hard `animtype` (Anim 5000/5001/5002) through a limited ActiveHitDef. Missing required animations are diagnosed without substitution. Other HitDef/get-hit parameters remain incomplete. |
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
| PlayerPush | Partial | `value = 0` disables fallback stage push for its execution frame. Grounded players always use horizontal push; airborne cross-over requires fixed 44x80 boxes to clear vertically. Width/AIR `Clsn2` integration remains incomplete. |
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
| VelAdd | Complete | X values are facing-relative and converted once to world velocity. |
| VelMul | Complete | Multiplies the stored world velocity without reapplying facing. |
| VelSet | Complete | X values are facing-relative; positive X moves forward for either facing. |
| Width | Partial | Stores width fields only. Collision integration needs audit. |
| Zoom | Partial | Recognized safe no-op. Camera zoom not implemented. |

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
| BackEdgeDist | Partial | Uses internal screen/player coordinate approximation. |
| BodyDist X | Partial | Evaluates opponent center distance like P2BodyDist X; precise body edge width is still incomplete. |
| BodyDist Y | Partial | Evaluates opponent/player Y coordinate difference like P2BodyDist Y; precise body edge height is still incomplete. |
| CanRecover | Partial | Safe default currently returns true. |
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
| StateType | Complete | Basic support. |
| SysFVar | Unsupported | System float vars not implemented. |
| SysVar | Complete | Basic numeric comparison. |
| Tan | Complete | Numeric math function supported in runtime trigger evaluator. |
| TeamMode | Unsupported | Team mode not implemented. |
| TeamSide | Partial | Context/player id fallback. |
| TicksPerSecond | Complete | Constant 60. |
| Time | Complete | State time comparison. |
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
