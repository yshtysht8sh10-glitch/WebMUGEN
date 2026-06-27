# WebMUGEN WinMUGEN Compatibility Matrix

Created: 2026-06-27

This document is the working compatibility checklist for WebMUGEN. It is intentionally broad: the goal is to make unsupported behavior visible before implementing more character logic.

Sources used as the compatibility baseline:

- Elecbyte MUGEN CNS trigger reference: https://www.elecbyte.com/mugendocs-11b1/trigger.html
- Elecbyte MUGEN state controller reference: https://www.elecbyte.com/mugendocs-11b1/sctrls.html
- Elecbyte MUGEN CNS format reference: https://www.elecbyte.com/mugendocs-11b1/cns.html
- Elecbyte MUGEN common states reference: https://www.elecbyte.com/mugendocs-11b1/common1.html
- WinMUGEN-era behavior should be checked against actual WinMUGEN where the 1.0/1.1 docs differ.

## Status Legend

| Status | Meaning |
|---|---|
| Done | Implemented and covered by tests or known runtime usage. |
| Partial | Implemented only for simple cases, or implemented in one runtime path but not broadly compatible. |
| Planned | Intentionally in scope, not implemented yet. |
| Unsupported | Not implemented and no compatibility shim exists. |
| Needs Audit | Needs verification against WinMUGEN or existing code before marking. |

## StateDef Compatibility

MUGEN characters may define arbitrary positive state numbers. Therefore the complete finite list is the common/reserved state set plus known conventional ranges. Character-specific state numbers are open-ended.

| StateNo / Range | WinMUGEN Meaning | WebMUGEN Status | Notes |
|---:|---|---|---|
| -3 | Global state, runs every tick before -2/-1 in many MUGEN patterns | Planned | Runtime currently handles -1/-2. -3 should be added before full compatibility. |
| -2 | Global state, runs every tick | Partial | `stepCnsStateRuntime` handles -2. Coverage incomplete. |
| -1 | Command state | Partial | Used for CMD routing. Command merging exists. Needs broader controller/trigger support. |
| 0 | Stand | Done | Common baseline and idle fallback exist. |
| 10 | Crouch start | Partial | Common route exists. Character/common override interactions still being validated. |
| 11 | Crouching | Partial | Common route exists. |
| 12 | Crouch end | Partial | Common route exists. |
| 20 | Walk forward | Partial | Common route exists. Current active debugging target. |
| 21 | Walk back | Partial | Added as common back-walk state. |
| 40 | Jump start | Partial | Common route exists. Jump velocity is minimal. |
| 41 | Character-defined jump variant | Needs Audit | KFM can define this. Not common-guaranteed. |
| 42 | Character-defined jump variant | Needs Audit | Common implementations may vary. |
| 45 | Air jump / jump transition variant | Planned | Needs WinMUGEN/common1 verification. |
| 50 | Jump up | Partial | Common baseline exists. Air physics incomplete. |
| 51 | Jump down | Planned | Needed for more accurate air-state sequencing. |
| 52 | Jump land | Partial | Common baseline exists. Landing logic under active work. |
| 100 | Run / dash forward | Partial | Common route added with PosAdd. Needs true velocity/friction behavior. |
| 101-104 | Run / dash substates | Needs Audit | Common implementations vary. |
| 105 | Hop back / back dash | Partial | Common route added with PosAdd. |
| 106-107 | Back dash substates | Needs Audit | Common implementations vary. |
| 120 | Guard start | Planned | Required for basic defense. |
| 130 | Standing guard | Planned | Required for basic defense. |
| 131 | Crouching guard | Planned | Required for basic defense. |
| 132 | Air guard | Planned | Required for basic defense. |
| 140 | Guard hit / guard recoil | Planned | Required for blocking. |
| 150 | Standing/crouching guard hit | Planned | Required for blocking. |
| 151 | Guard hit continuation | Planned | Required for blocking. |
| 152 | Guard hit continuation | Planned | Required for blocking. |
| 153 | Air guard hit | Planned | Required for air blocking. |
| 154 | Air guard hit continuation | Planned | Required for air blocking. |
| 155 | Air guard recovery | Planned | Required for air blocking. |
| 170 | Lose | Planned | Round flow only partially implemented. |
| 175 | Time over lose | Planned | Round flow only partially implemented. |
| 180 | Win | Planned | Round flow only partially implemented. |
| 181 | Win continuation | Planned | Round flow only partially implemented. |
| 190 | Intro / pre-fight | Planned | Round intro not implemented. |
| 191 | Intro continuation | Planned | Round intro not implemented. |
| 192-199 | Intro/custom intro variants | Needs Audit | Character-specific. |
| 5000 | Stand get-hit | Planned | Hit reaction foundation exists but common get-hit states are not compatible. |
| 5001 | Stand get-hit continuation | Planned | Needs common1 behavior. |
| 5010 | Crouch get-hit | Planned | Needs crouch hit reaction. |
| 5011 | Crouch get-hit continuation | Planned | Needs common1 behavior. |
| 5020 | Air get-hit | Planned | Needs air hit reaction. |
| 5030 | Air recover | Planned | Needs fall recovery. |
| 5040 | Air get-hit / recover variant | Needs Audit | Common implementations vary. |
| 5050 | Fall | Planned | Required for launch/fall. |
| 5060 | Fall bounce | Planned | Required for knockdown. |
| 5070 | Trip | Planned | Required for sweep/trip behavior. |
| 5080 | Lie down / fall transition | Planned | Required for knockdown. |
| 5100 | Hit ground | Planned | Required for knockdown. |
| 5110 | Lie down | Planned | Required for knockdown. |
| 5120 | Get up | Planned | Required for recovery. |
| 5150 | Dead / KO | Planned | Required for KO compatibility. |
| 5200 | Fall recovery | Planned | Required for air recovery. |
| 5210 | Fall recovery landing | Planned | Required for air recovery. |
| 5300+ | Character/system/custom states | Needs Audit | Open-ended. Track per character. |
| 800-899 | Throw states by convention | Needs Audit | KFM uses command routes in this range. |
| 1000+ | Specials/projectiles/helpers by convention | Needs Audit | Character-specific. |

## StateDef Header Fields

| Field | Purpose | WebMUGEN Status | Notes |
|---|---|---|---|
| type | State type: S/C/A/L | Done | Parsed and applied. |
| movetype | I/A/H | Done | Parsed and applied. |
| physics | S/C/A/N | Partial | Parsed and applied. Physics behavior incomplete. |
| anim | Initial animation | Done | Parsed and applied. Animless state preservation is implemented. |
| ctrl | Control flag | Done | Parsed and applied. |
| poweradd | Power gain on state entry | Unsupported | Need parser/runtime support. |
| juggle | Juggle points | Unsupported | Needed for hit system compatibility. |
| facep2 | Face opponent on state entry | Unsupported | Needed for many attacks. |
| hitdefpersist | Keep HitDef on state change | Unsupported | Hit system compatibility. |
| movehitpersist | Keep MoveHit info | Unsupported | Hit system compatibility. |
| hitcountpersist | Keep hit count | Unsupported | Hit system compatibility. |
| sprpriority | Sprite priority | Partial | Runtime/rendering needs audit. |

## State Controller Compatibility

| Controller | WebMUGEN Status | Notes |
|---|---|---|
| AfterImage | Unsupported | Visual effect. |
| AfterImageTime | Unsupported | Visual effect. |
| AllPalFX | Unsupported | Palette effect. |
| AngleAdd | Unsupported | Transform effect. |
| AngleDraw | Unsupported | Transform/render effect. |
| AngleMul | Unsupported | Transform effect. |
| AngleSet | Unsupported | Transform effect. |
| AppendToClipboard | Unsupported | Debug clipboard. |
| AssertSpecial | Unsupported | Commonly appears in KFM. Needs flags support. |
| AttackDist | Unsupported | AI/guard distance behavior. |
| AttackMulSet | Unsupported | Damage scaling. |
| BGPalFX | Unsupported | Background palette effect. |
| BindToParent | Unsupported | Helper binding. |
| BindToRoot | Unsupported | Helper binding. |
| BindToTarget | Unsupported | Target binding. |
| ChangeAnim | Done | Basic implementation exists. |
| ChangeAnim2 | Unsupported | Needed for custom get-hit animations. |
| ChangeState | Done | Basic implementation exists. |
| ClearClipboard | Unsupported | Debug clipboard. |
| CtrlSet | Done | Basic implementation exists. |
| DefenceMulSet | Unsupported | Defense scaling. |
| DestroySelf | Unsupported | Helper/projectile cleanup. |
| DisplayToClipboard | Unsupported | Debug clipboard. |
| EnvColor | Unsupported | Screen effect. |
| EnvShake | Unsupported | Screen effect. |
| Explod | Partial | Explod system exists, CNS controller coverage needs audit. |
| ExplodBindTime | Unsupported | Explod behavior. |
| ForceFeedback | Unsupported | Device feedback. |
| GameMakeAnim | Unsupported | Global animation effect. |
| Gravity | Unsupported | Can be approximated by physics=A, but controller not implemented. |
| Helper | Partial | Helper system exists, CNS controller compatibility needs audit. |
| HitAdd | Unsupported | Hit counter. |
| HitBy | Unsupported | Hit vulnerability. |
| HitDef | Partial | HitDef parser/runtime exists, full compatibility incomplete. |
| HitFallDamage | Unsupported | Fall damage. |
| HitFallSet | Unsupported | Fall state behavior. |
| HitFallVel | Unsupported | Fall velocity. |
| HitOverride | Unsupported | Hit override behavior. |
| HitVelSet | Unsupported | Get-hit velocity. |
| LifeAdd | Done | Basic implementation exists. |
| LifeSet | Unsupported | Direct life set. |
| MakeDust | Unsupported | Visual effect. |
| ModifyExplod | Unsupported | Explod modification. |
| MoveHitReset | Unsupported | Move contact flags. |
| NotHitBy | Unsupported | Hit vulnerability. |
| Null | Partial | Unknown controllers are effectively no-op; explicit Null should be supported/tested. |
| Offset | Unsupported | Draw offset. |
| PalFX | Unsupported | Palette effect. |
| ParentVarAdd | Unsupported | Helper parent variables. |
| ParentVarSet | Unsupported | Helper parent variables. |
| Pause | Partial | Pause system exists, controller compatibility needs audit. |
| PlayerPush | Unsupported | Player collision push. |
| PlaySnd | Unsupported | Sound system not integrated. |
| PosAdd | Done | Basic implementation exists. |
| PosFreeze | Unsupported | Position freeze. |
| PosSet | Done | Basic implementation exists. |
| PowerAdd | Done | Basic implementation exists. |
| PowerSet | Unsupported | Direct power set. |
| Projectile | Partial | Projectile system exists, CNS controller compatibility needs audit. |
| RemoveExplod | Unsupported | Explod cleanup. |
| ReversalDef | Unsupported | Reversal/counter system. |
| ScreenBound | Unsupported | Camera/screen bounds. |
| SelfState | Unsupported | Required for custom states and target states. |
| SprPriority | Unsupported | Rendering priority. |
| StateTypeSet | Done | Basic implementation exists. |
| StopSnd | Unsupported | Sound system. |
| SndPan | Unsupported | Sound system. |
| SuperPause | Unsupported | Super pause. |
| TargetBind | Unsupported | Target manipulation. |
| TargetDrop | Unsupported | Target manipulation. |
| TargetFacing | Unsupported | Target manipulation. |
| TargetLifeAdd | Unsupported | Target manipulation. |
| TargetPowerAdd | Unsupported | Target manipulation. |
| TargetState | Unsupported | Target manipulation. |
| TargetVelAdd | Unsupported | Target manipulation. |
| TargetVelSet | Unsupported | Target manipulation. |
| Trans | Unsupported | Transparency/rendering. |
| Turn | Unsupported | Facing change controller. |
| VarAdd | Done | Basic implementation exists. |
| VarRandom | Unsupported | Random variable assignment. |
| VarRangeSet | Unsupported | Range variable assignment. |
| VarSet | Done | Basic implementation exists. |
| VelAdd | Done | Basic implementation exists. |
| VelMul | Unsupported | Velocity multiply. |
| VelSet | Done | Basic implementation exists. |
| Width | Unsupported | Push/attack width. |
| Zoom | Unsupported | MUGEN 1.1 camera feature; WinMUGEN likely not applicable. |

## Trigger Compatibility

| Trigger | WebMUGEN Status | Notes |
|---|---|---|
| Abs | Unsupported | Expression function. |
| ACos | Unsupported | Expression function. |
| AILevel | Done | Basic trigger support with default 0. |
| Alive | Done | Basic support. |
| Anim | Done | Numeric comparison. |
| AnimElem | Done | Simplified support. |
| AnimElemNo | Unsupported | Needs animation element resolver. |
| AnimElemTime | Done | Simplified support. |
| AnimExist | Unsupported | Needs AIR lookup. |
| AnimTime | Done | Uses MUGEN-style animation duration helper. |
| ASin | Unsupported | Expression function. |
| ATan | Unsupported | Expression function. |
| AuthorName | Unsupported | Metadata. |
| BackEdge | Unsupported | Screen/camera. |
| BodyDist | Unsupported | Distance to body edge. |
| CanRecover | Unsupported | Recovery. |
| Ceil | Unsupported | Expression function. |
| Command | Done | Basic command set matching. |
| Cond | Unsupported | Expression function. |
| Const | Unsupported | Constants lookup. |
| Cos | Unsupported | Expression function. |
| Ctrl | Done | Basic support. |
| DrawGame | Unsupported | Pause/superpause rendering. |
| E | Unsupported | Math constant. |
| Exp | Unsupported | Expression function. |
| Facing | Done | Numeric comparison. |
| Floor | Unsupported | Expression function. |
| FrontEdge | Unsupported | Screen/camera. |
| FVar | Unsupported | Float variables. |
| GameTime | Unsupported | Global frame count trigger. |
| GetHitVar | Unsupported | Get-hit data. |
| HitCount | Unsupported | Hit counter. |
| HitDefAttr | Unsupported | HitDef attributes. |
| HitFall | Unsupported | Hit state. |
| HitOver | Unsupported | Hit state. |
| HitPauseTime | Unsupported | Hit pause. |
| HitShakeOver | Unsupported | Hit state. |
| HitVel | Unsupported | Hit velocity. |
| ID | Unsupported | Player/helper id. |
| IfElse | Unsupported | Expression function. |
| InGuardDist | Unsupported | Guard logic. |
| IsHelper | Unsupported | Helper logic. |
| IsHomeTeam | Unsupported | Team side. |
| Life | Done | Numeric comparison. |
| LifeMax | Unsupported | Max life const. |
| Ln | Unsupported | Expression function. |
| Log | Unsupported | Expression function. |
| Lose | Unsupported | Round result. |
| LoseKO | Unsupported | Round result. |
| LoseTime | Unsupported | Round result. |
| MatchNo | Unsupported | Match metadata. |
| MatchOver | Unsupported | Round/match state. |
| MoveContact | Unsupported | Move contact flag. |
| MoveGuarded | Unsupported | Move contact flag. |
| MoveHit | Unsupported | Move contact flag. |
| MoveReversed | Unsupported | Move contact flag. |
| MoveType | Done | Basic support. |
| Name | Unsupported | Player metadata. |
| NumEnemy | Unsupported | Teams/enemies. |
| NumExplod | Unsupported | Explod count. |
| NumHelper | Unsupported | Helper count. |
| NumPartner | Unsupported | Team mode. |
| NumProj | Unsupported | Projectile count. |
| NumProjID | Unsupported | Projectile count by id. |
| NumTarget | Unsupported | Target count. |
| P1Name | Unsupported | Metadata. |
| P2BodyDist | Unsupported | Opponent body distance. |
| P2Dist | Unsupported | Opponent distance. |
| P2Life | Unsupported | Opponent life. |
| P2MoveType | Unsupported | Opponent move type. |
| P2Name | Unsupported | Opponent metadata. |
| P2StateNo | Unsupported | Opponent state. |
| P2StateType | Unsupported | Opponent state type. |
| P3Name | Unsupported | Team metadata. |
| P4Name | Unsupported | Team metadata. |
| PalNo | Unsupported | Palette slot. |
| ParentDist | Unsupported | Helper parent. |
| Pi | Unsupported | Math constant. |
| PlayerIDExist | Unsupported | Player/helper id lookup. |
| Pos | Done | Basic x/y comparison. |
| Power | Done | Basic support with default 0. |
| PowerMax | Unsupported | Max power const. |
| PrevStateNo | Unsupported | Needs previous state tracking. |
| ProjCancelTime | Unsupported | Projectile contact. |
| ProjContact | Unsupported | Projectile contact. |
| ProjContactTime | Unsupported | Projectile contact. |
| ProjGuarded | Unsupported | Projectile contact. |
| ProjGuardedTime | Unsupported | Projectile contact. |
| ProjHit | Unsupported | Projectile contact. |
| ProjHitTime | Unsupported | Projectile contact. |
| Random | Unsupported | Random expression. |
| RootDist | Unsupported | Helper root. |
| RoundNo | Unsupported | Round metadata. |
| RoundsExisted | Unsupported | Round metadata. |
| RoundState | Done | Basic support with default 2 unless supplied. |
| ScreenPos | Unsupported | Screen/camera. |
| SelfAnimExist | Unsupported | AIR lookup. |
| Sin | Unsupported | Expression function. |
| StateNo | Done | Numeric comparison. |
| StateType | Done | Basic support. |
| SysFVar | Unsupported | Float system variables. |
| SysVar | Done | Basic numeric comparison. |
| Tan | Unsupported | Expression function. |
| TeamMode | Unsupported | Team mode. |
| TeamSide | Unsupported | Team side. |
| TicksPerSecond | Unsupported | Engine constant. |
| Time | Done | State time comparison. |
| UniqHitCount | Unsupported | Hit counter. |
| Var | Done | Basic numeric comparison. |
| Vel | Done | Basic x/y comparison. |
| Win | Unsupported | Round result. |
| WinKO | Unsupported | Round result. |
| WinPerfect | Unsupported | Round result. |
| WinTime | Unsupported | Round result. |

## Redirects / Player References

| Redirect | WebMUGEN Status | Notes |
|---|---|---|
| enemy | Unsupported | Needed for P2/P3/P4 and team behavior. |
| enemynear | Unsupported | Needed for most opponent checks. |
| helper | Unsupported | Needed for helper state logic. |
| parent | Unsupported | Needed for helper/parent logic. |
| partner | Unsupported | Team mode. |
| root | Unsupported | Helper root. |
| target | Unsupported | Hit target manipulation. |
| playerid | Unsupported | Player lookup by id. |

## Expression / Operator Support

| Feature | WebMUGEN Status | Notes |
|---|---|---|
| Numeric comparisons = != > >= < <= | Done | Simple trigger forms. |
| String equality | Partial | `command`, state type, move type, physics. |
| Boolean AND between triggerall and triggerN | Done | Covered by trigger group evaluator. |
| OR between trigger groups | Done | Multiple triggerN groups supported. |
| Arithmetic + - * / % | Unsupported | Needed for broad CNS compatibility. |
| Unary minus | Partial | Supported only as parsed numeric literal in simple expressions. |
| Parentheses | Unsupported | General parser not implemented. |
| && / || / ! | Unsupported | General boolean parser not implemented. |
| Functions | Unsupported | See trigger function entries above. |
| Indexed access var(n), sysvar(n) | Done | Basic numeric support. |
| Float vars fvar/sysfvar | Unsupported | Needed. |
| Redirection expression chains | Unsupported | Example: `enemynear, stateno`. |

## CMD Compatibility

| Feature | WebMUGEN Status | Notes |
|---|---|---|
| Single button commands | Done | Basic support. |
| Hold direction `/D`, `/F`, etc. | Done | Basic support. |
| Direction sequences | Partial | Command matcher exists; needs WinMUGEN timing audit. |
| Button sequences | Partial | Basic support. |
| Simultaneous buttons | Partial | Needs full syntax audit. |
| Release commands | Needs Audit | Check `~` syntax behavior. |
| Buffer time | Partial | InputBuffer exists, timing needs compatibility tests. |
| command.time | Needs Audit | Parser/runtime status needs verification. |
| command.buffer.time | Needs Audit | Parser/runtime status needs verification. |
| `$` 4-way direction match | Partial | KFM hold commands work; full syntax needs tests. |
| `/` hold prefix | Partial | Used in common commands. Needs syntax coverage. |
| `+` simultaneous input | Partial | Needs tests. |

## Current High-Priority Compatibility Gaps

| Priority | Gap | Reason |
|---:|---|---|
| 1 | State -3 execution | Many common systems depend on -3/-2/-1 ordering. |
| 1 | State20/21/10/11/12 runtime validation | Basic movement must be reliable before attacks. |
| 1 | Air physics and State51/52 landing | Jump compatibility depends on this. |
| 1 | General expression parser | Many real CNS triggers cannot be expressed as one simple comparison. |
| 2 | P2/enemy redirects | Needed for real attacks, AI, spacing, and throws. |
| 2 | HitDef runtime completeness | Required for normal attacks and specials. |
| 2 | SelfState / TargetState / custom states | Required for throws and get-hit states. |
| 3 | Explod / Helper controller compatibility | Required for visual effects and projectiles beyond basics. |
| 3 | Sound controllers | Required for presentation compatibility. |
| 3 | PalFX/AfterImage/Trans | Required for visual compatibility. |

## Maintenance Rules

1. Every new controller or trigger implementation should update this file in the same PR/commit.
2. Status must not be marked Done without either a focused unit test or a confirmed app integration path.
3. Partial entries should include what subset is implemented.
4. WinMUGEN-specific deviations from MUGEN 1.0/1.1 docs should be recorded in Notes.
5. Character-specific issues should link to the character file and state number where possible.
