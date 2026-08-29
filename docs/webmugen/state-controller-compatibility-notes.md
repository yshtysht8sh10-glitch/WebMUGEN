# State Controller Compatibility Notes

Updated: 2026-08-28

This document summarizes State Controller implementation notes. The compatibility matrix remains the source of truth:

- `docs/webmugen/winmugen-compatibility-matrix.html`
- `docs/webmugen/winmugen-compatibility-matrix.md`

Follow `docs/webmugen/development-policy.md`: TypeScript executes MUGEN data; do not turn it into a hidden KFM-specific rulebook.

## Status rule

- **Complete**: implemented and covered by focused tests or confirmed runtime usage.
- **Partial**: safe no-op, placeholder storage, approximate behavior, or incomplete integration.
- **Unsupported**: not implemented.
- **Untested**: implementation may exist but lacks verification.

Recognized safe no-ops are normally **Partial**, not Complete.

## Current controller families

| Family | Examples | Current note |
|---|---|---|
| Common parameters | `persistent`, `ignorehitpause` | `persistent = 0` executes a Controller only once per stay in its StateDef and resets on re-entry; omitted/default 1 remains unrestricted. Values greater than 1 still lack exact every-Nth-trigger cadence. `ignorehitpause` is connected to the selective hit-pause Controller pass; StateTime advances for P2 hit-shake and freezes for P1 pause. Issue #131 verifies bundled itoko's Time=1 VarAdd executes once during GuardHit shake and feeds Helper 2030. |
| State transition | `ChangeState`, `SelfState` | `ChangeState` preserves current State-document and supplying-entity ownership and applies its `ctrl` value before destination StateDef entry, so an explicit destination `ctrl` wins while omission inherits the controller value. Hit-stun protection blocks State -1 input routes that read `Command`. During HitPause, a narrow WinMUGEN compatibility path permits automatic non-Command State -2 transitions; Issue #131 verifies itoko reaches guard-break State 2031/Anim 2035 before its reset VarSet. `SelfState` returns borrowed players to their own CNS document and clears the supplying entity. Helper-as-target and animation ownership remain Partial. |
| Animation | `ChangeAnim`, `ChangeAnim2` | `ChangeAnim` evaluates numeric `value` expressions with current player context and uses the entity's self animation owner. `ChangeAnim2` resolves AIR from the current custom-State owner while resolving the selected group/image from the animated player's self SFF. Bundled T-H-M-A Darkness Finger Shinuchi State 3425 verifies this split together with its preceding `p2facing = 1`. SelfState restores self AIR ownership. Different-character missing assets and broader Helper variants remain Partial. |
| Velocity/position | `VelSet`, `VelAdd`, `VelMul`, `PosSet`, `PosAdd`, `Turn` | `VelSet`/`VelAdd` X values are converted from facing-relative CNS coordinates to world velocity when applied. `VelMul` scales that stored world velocity without applying facing again. Because the runtime stores world velocity while MUGEN exposes `Vel X` relative to Facing, `Turn` flips both Facing and stored world `vx`; bundled T-H-M-A State 3937 therefore reverses the preceding `+98.5` screen velocity at the opposite wall. `PosSet` evaluates X/MUGEN Y expressions with player/opponent redirect context, then converts X from the current screen center to internal world space; trigger `Pos X` converts back using the same frame camera. `PosAdd` evaluates the same expression surface and converts X from Facing-relative to world position. Bundled State 3110 covers turn, `Enemy(0), Pos X/Y`, and the final behind-opponent offset. |
| State flags | `CtrlSet`, `StateTypeSet`, `MoveTypeSet`, `AssertSpecial` | `CtrlSet`, `StateTypeSet`, and `MoveTypeSet` persist while the current State remains active; StateDef entry headers do not overwrite them on later ticks. This includes a positive State into the following tick's State -1 scan for Ctrl and T-H-M-A State 3410 retaining its airborne type until a missed rush reaches the wall. Active hit stun still suppresses premature control. All three AssertSpecial slots are retained per entity for the asserted tick and deassert before the next tick. Facing/invisible, stand/crouch/air guard prohibition, unguardable, juggle bypass, stage background, and HUD consumers are connected. Round/timer/audio/shadow/noFG/nowalk consumers and exact hitpause persistence remain incomplete. |
| Debug/device | `DisplayToClipboard`, `AppendToClipboard`, `ClearClipboard`, `ForceFeedback` | Per-player formatted debug buffers are visible in Physics Debug Overlay. ForceFeedback is normalized and mapped to a connected dual-rumble Gamepad with safe unavailable/rejection handling. Exact printf flags, physical-device confirmation, pad ownership, disconnect cancellation, and waveform parity remain Partial. |
| Player collision | `PlayerPush`, `Width`, `ScreenBound` | `PlayerPush = 0` disables separation for its execution frame. `Width` evaluates tick-scoped front/back `edge` and `player` pairs. `ScreenBound` feeds the shared 320/400x240 camera: roots participate unless disabled; normal Helpers default to `value = 0, movecamera = 0,0` and participate per axis only when their own controller opts in. When no entity opts into an axis, the preceding camera coordinate is retained instead of falling back to roots. `value` controls containment independently from `movecamera`. External stages apply DEF camera bounds/tension/vertical follow/floor tension and Bound screen insets. Negative Width values, Helper containment, exact camera hysteresis, and PlayerInfo bounds remain incomplete. |
| Life/power | `LifeAdd`, `LifeSet`, `PowerAdd`, `PowerSet` | PowerAdd/PowerSet use the shared player-specific 0..`powerMax` clamp and emit mutation diagnostics. Header `poweradd` is tracked separately as a StateDef header field. Helper ownership remains Partial. |
| Vars | `VarSet`, `VarAdd`, `VarRangeSet`, `VarRandom` | Enforces Var 0..59/FVar 0..39/SysVar and SysFVar 0..4, supports `v`/`fv`, full-family range defaults, inclusive VarRandom ranges, and one-shot `persistent = 0` execution. Exact Elecbyte PRNG sequencing, `persistent = N` cadence for N greater than 1, and broader redirect ownership remain Partial. |
| Hit-related | `HitDef`, `HitBy`, `NotHitBy`, `HitVelSet`, `HitFallVel`, `HitFallDamage` | `HitDef` evaluates a typed activation snapshot for major fields. Normal and guard damage/pause/hit time/velocity, guard control/kill, ground/air reaction, fall/recover data, and basic down time reach live common-state paths. Projectile contact shares KO, HitBy/NotHitBy, and H/L/M/A/F/D eligibility; lying targets require `D`, cannot guard, and accepted contact uses State 5080 plus the down parameter branch. `affectteam` defaults to E and enforces E/F/B eligibility for root-vs-root and Helper-vs-root contact. `p2stateno` defaults omitted `p2getp1state` to 1 and borrows the attacker State document; explicit 0 retains the target document. Team partners, Helper defenders and advanced guard/fall/down behavior remain Partial. |
| Target-related | `TargetState`, `TargetVelSet`, `TargetLifeAdd`, etc. | TargetState records both the controller's character owner and unique root/Helper entity, executes that owner's CNS, and resolves borrowed-State Root/Parent/Helper redirects from the supplying entity; Helper-issued root TargetState also executes the destination `Time = 0` pass before physics. TargetVelSet/TargetVelAdd convert X from the selected target's Facing coordinates to world velocity when applied; Issue #133 verifies both Facings and itoko Helper State 1464 launching left-facing P2 rightward with `x = -0.5`. Projectile hits acquire the same generic Target and SelfState returns it to its own CNS. An acquired Target remains selectable after lethal damage so delayed custom-State release controllers can finish. TargetBind maintains finite or indefinite Facing-relative root or uniquely identified Helper position and velocity; the expiration tick receives its final synchronization before metadata clears. Finite time freezes for owner P1 pause but continues through target-only P2 hit-shake, preserving itoko's Issue #125 launch route and final ground release. TargetLifeAdd applies attack/defense multipliers by default, supports `absolute = 1`, honors `kill = 0`, and replaces non-finite stored multipliers before they can poison Life. Helper-as-target/team/multi-player lookup, exact global Pause/movetime timing, animation ownership, and coordinate scaling remain incomplete. |
| Combat interception | `AttackDist`, `HitOverride`, `ReversalDef`, `HitFallSet` | AttackDist updates the live HitDef guard range. HitOverride uses timed attribute slots, keeps `time = -1` active indefinitely, supports WinMUGEN `AA`/`AP` Any-class filters, replaces normal damage with a configured self State, and preserves the incoming HitDef's `GetHitVar` snapshot; `forceair` selects air hit data. Bundled T-H-M-A State -1 blocking reaches State 902 for P1/P2 and both Facings, interrupted Shinuchi State 3970 receives `yaccel` and exits to State 5100, and colliding itoko bag Helpers enter State 1102 without common itoko hit sprites. ReversalDef uses Clsn1-vs-Clsn1, incoming attribute filtering, custom states, pause, Target registration, and MoveReversed without aliasing normal HitDef. HitFallSet remains connected to the common fall snapshot. Projectile parity, reversal effects, and exact pause/priority ordering remain Partial. |
| Helper/Projectile/Explod | `Helper`, `DestroySelf`, `BindToParent`, `BindToRoot`, `BindToTarget`, `ParentVarSet`, `ParentVarAdd`, `Projectile`, `Explod`, `ModifyExplod`, `RemoveExplod`, `ExplodBindTime` | Helpers execute independent States and active Helper HitDefs collide with the opposing root. Helper creation applies `size.xscale`/`size.yscale` to rendering and Size geometry and uses separate `pausemovetime`/`supermovetime` allowances while paused. Explod allowances distinguish zero freeze, positive finite consumption, and negative indefinite movement; bundled T-H-M-A State 3500 covers `supermovetime = -1`. Controller parameter tuples preserve redirect commas; bundled State 5400 evaluates `scale = 0.5-parent,fvar(12)/20, 0.25` against the root parent without turning the Explod Y scale into zero. Runtime-unique parent/root resolution drives persistent position/facing binds and immediate-parent var/fvar mutation; registered target binds support Foot/Mid/Head anchors and missing-source cleanup. Projectile and Explod production paths remain connected as documented. Helper-as-defender/Helper-vs-Helper combat, exact bind Pause timing, child-destruction policy, common fightfx assets, ownpal isolation, advanced blend/shadow, and broader non-player ownership remain Partial. |
| Visual/audio effects | `AfterImage`, `BGPalFX`, `AllPalFX`, `PalFX`, `EnvColor`, `EnvShake`, `GameMakeAnim`, `MakeDust`, `PlaySnd`, `StopSnd`, `SndPan`, `Pause`, `SuperPause`, `Trans`, `AngleDraw` | `AfterImage` captures position/facing/Anim plus tick-scoped AngleDraw angle/scale and renders gap-selected frames with those historical transforms. AngleSet/Mul/Add values use the current entity expression context and, when placed after AngleDraw, update the same rendered tick; State entry clears the prior State's draw transform. `AngleDraw` applies around the AIR-offset-adjusted root or Helper sprite axis with WinMUGEN's facing-relative counterclockwise-positive convention; scaling affects the AIR offset while rotation does not. Bundled itoko Action 106, State 52, and Helper 1210 cover rotation, landing reset, and same-pass ordering; T-H-M-A State 3735/3738 covers progressive rotation/scale. Background/palette effects, legacy fightfx, sound, shake and Pause/SuperPause remain connected as documented. Exact indexed-palette arithmetic, activation during hitpause, bundled common assets, same-pass pause ordering, and exact pan remain Partial. `Zoom` is version-gated as MUGEN 1.1 and not applicable to the WinMUGEN target. |

## Implementation guidance

Prefer implementing controller semantics generically rather than for a single state or character.

When a behavior can be expressed in CNS/CMD data, prefer using `public/chars/common.cmd` or character data instead of hard-coding in TypeScript.

Good TypeScript controller logic should:

- read controller parameters through the parsed CNS structure;
- evaluate triggers before execution;
- apply only the documented state mutation;
- return whether the controller actually executed;
- expose debug information when a route is under investigation.

## Complete vs Partial examples

`Null` can be Complete because its purpose is explicit no-op behavior.

`AfterImage` remains Partial after visual integration because exact indexed-palette arithmetic and every pause/Helper edge are not yet verified.

`HitDef` remains Partial: major parameters are evaluated once into `ActiveHitDef`, with unapplied and invalid fields diagnosed rather than silently dropped. The live runtime applies normal/guard/fall kill separation, explicit power pairs, numhits combo count, edge-only cornerpush selection (including WinMUGEN omitted-default inheritance verified by Issue #133), snap, sprite priorities, nonzero `p2facing` on successful non-guard hits, target class/attr/priority, chain eligibility, repeat prevention, and `hitonce` before entering common reaction states. Per Issue #114 real-machine verification, `p2facing = 1` makes P2 face opposite P1 and `p2facing = -1` makes P2 face the same way as P1, regardless of world-coordinate order; guard contacts do not apply it. H/L/M/A/F/D target classes are connected, the legacy `P` suffix is tolerated without changing the class match, and `+`/`-` select already-hit/not-already-hit targets. A different ActiveHitDef generation can contact a defender during existing HitPause; same-generation overlap remains blocked by the generation/defender history. Bundled T-H-M-A State 3165 -> 3169 and State 3030 -> 270 are focused real-data regressions. Required animations are not substituted when absent. mugen.cfg power defaults, camera-relative corner bounds, mixed priority-type edges, full team-mode validation, and broader get-hit integration remain incomplete.

`HitFallDamage` reads the contact-snapshotted `fall.damage` and honors `fall.kill`; the existing common State triggers ensure it executes at the intended landing time. Explicit legacy `value` remains accepted for backward compatibility.

## Test expectations

Controller tests should verify:

- trigger gating;
- parameter parsing;
- before/after player state;
- whether controller execution is reported;
- interaction with state entry when relevant.

Movement-oriented controllers should assert velocity, position, animation, and state transitions directly.

## Issues #115-#131

Focused coverage now verifies channel-preserving PalFX/BGPalFX, visible AfterImage `length` with non-unit gaps, shared Helper/root Power, creation-tick `projremovetime = 1`, and common guard-ready contact. These remain Partial where indexed-palette rounding, multi-Helper write ordering, or advanced Projectile behavior is not covered.
