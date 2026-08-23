# CNS Runtime

Updated: 2026-08-16

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

Root-player common-state handling also owns WinMUGEN's special AirJump bookkeeping. After ordinary
negative-State command routes have had priority, a fresh Up press may enter State 45 only while the
player has control, is airborne at least `Const(movement.airjump.height)` above ground, and has not
used `Const(movement.airjump.num)` air jumps. Grounded execution resets the count. A held Up input is
latched so the original jump press cannot automatically trigger the air jump when the height threshold
is crossed. Helpers do not receive this root-only special-State behavior.

## Runtime order

For each root player, the current order is:

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

Helper processing is intentionally narrower:

```text
keyctrl = 0: current StateDef
keyctrl = 1: State -1 -> current StateDef
```

State -3 and State -2 are root-only. State -1 is available to a Helper only when `keyctrl = 1`;
the root command set is then supplied to that Helper. This eligibility is selected by entity kind
and `keyctrl`, without character, Helper ID, or State-number exceptions.

Because both roots execute before existing Helpers, Helper relationship redirects to a root use the
root's completed State for that same tick. Issue #122 relies on this ordering when itoko's root enters
neutral State 1301 while H1350 enters neutral State 1350: the destination Helper State must not read
the preceding root State 1330 and bounce immediately back into State 1480.

If a negative state changes `stateNo`, the runtime exits early for that player after recording the transition. This prevents old-state logic from running after State -1 has already changed state.

WinMUGEN's engine-owned State 140 exit is applied after the current State's
controllers. At `AnimTime = 0`, the resulting StateType selects State 0, 11, or
51. The post-controller ordering is significant: character-defined guard-end
cleanup, such as itoko's `var(1)` reset, must execute before the engine leaves
State 140.

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

StateDef `movetype` omission resolves to WinMUGEN's `I` default. Explicit `movetype = U` is the
separate keep-unchanged form. The same resolver is used by ordinary centralized transitions and by
the first CNS pass after an external state entry, preventing an attack MoveType from leaking into an
idle State 0 and suppressing Stage AutoTurn.

For `ChangeState ctrl`, the controller value is applied before destination entry. An explicit
destination StateDef `ctrl` therefore determines the final same-frame value; omission inherits the
controller value. Focused T-H-M-A State 6000 -> 60001 coverage verifies that `ctrl = 1` followed by
the destination header's `ctrl = 0` cannot expose walk or crouch input on the next State -1 scan.

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

Issue #58 Phase 2 gates the crouch-route `debugControllerCheck` formatter before it is called.
When trace debugging is disabled, the production `shouldRun` result is consumed directly and the
formatter does not rebuild or re-evaluate Trigger diagnostics. When debugging is enabled, the
existing detailed `eval`, group, and `STATE10` lines remain unchanged. This phase does not alter
Trigger grouping, expression evaluation, parsing, or evaluation order.

Issue #58 Phase 3 prepares Controller Trigger groups at CNS parse completion. Normal runtime
evaluation reads the cached `triggerall` and numbered groups, preserving the former source-order
short-circuit behavior. For a Controller with one `triggerall` and two numbered groups, the former
per-evaluation grouping allocations (`triggerall` array, two group arrays, `Map`, and values array)
are replaced by zero grouping allocations after load.

Issue #58 Phase 4 compiles Trigger expressions after the final character/common CNS merge. Runtime
Controller decisions call the prepared evaluator associated with each Trigger record; normalization,
boolean splitting, comparison matching, arithmetic tree construction, function argument splitting,
and Redirect child compilation are not repeated per frame. The old string evaluator remains only as
a test oracle. A local 33,665-evaluation itoko sample measured 288.87 ms through the legacy path and
5.25 ms through the warmed compiled path (98.2% reduction in Trigger-evaluator time for that sample).

Issue #58 Phase 5 prepares a first-State-wins `Map<number, StateDef>` for each parsed or merged CNS
document. State Runtime, Helper initialization, CNS physics, and the legacy StateMachine adapter use
`Map.get(stateNo)` instead of scanning `states`. Repeated lookups reuse the same Map; replacing a
document's State array invalidates and rebuilds the index once. The first duplicate StateNo remains
selected, matching the former `Array.find` rule. A local itoko sample of 80,000 mixed hit/miss lookups
measured 82.15 ms linear and 5.16 ms indexed (93.7% lookup-time reduction); State lookup was already
a small part of total frame CPU.

## Compatibility cautions

Do not hard-code state numbers unless the behavior is truly an engine-level common rule and cannot be expressed as MUGEN data.

When a route can be represented in `common.cmd`, prefer `common.cmd`.

When a behavior depends on a future subsystem, implement the safest observable partial behavior and keep the matrix status Partial.

HitDef activation evaluates its major numeric expressions and pairs into a typed `ActiveHitDef` snapshot. Collision and later hit processing consume that snapshot instead of re-reading the originating controller after a hit. Parameters that are stored for later HitDef phases but not yet behaviorally connected are emitted in activation diagnostics and remain Partial.

The fallback hit recovery layer must not terminate an active common fall/down lifecycle. Grounded launch hits can enter States 5030/5035 with `HitFall=1` even when `targetStateTypeAtHit` was S/C; after hit-stun ends, those reactions continue through common States 5050, 5100/5110, 5120, and finally State 0. The engine-owned 5110→5120 handoff occurs at the start of a CNS pass after the lying clock becomes ready, so character State 5120 Time=0 Controllers can complete before rendering. States 5200/5210 remain CNS-controlled and require both `CanRecover` and `Command = "recovery"`.

Issue #62 completes the common KO handoff. A lethal normal hit, guarded hit, or `HitFallDamage` records `koReason=hit`, `guard`, or `fall`, while independent `kill`, `guard.kill`, and `fall.kill` flags clamp their own nonlethal path at one Life. Hit pause finishes before State 5110 can route a defeated player into State 5150. Already-defeated players reject new HitDef collisions and cannot be newly registered as Targets. A Target acquired before lethal damage remains selectable until explicit drop, entity disappearance, or round restart so delayed custom-State cleanup can finish.

Lethal normal and guarded contact force the get-hit fall flag so the existing common 5000/5030/5100/5110 data reaches 5150. A guarded KO remains a guarded contact for effects and MoveGuarded, but uses the normal get-hit reaction instead of returning to guard idle with zero Life. No direct State 5150 jump is hard-coded.

Issue #131 connects standard GuardHit collision entry to the same destination-State Time=0 pass used by other external transitions. Issue #134 applies that entry rule to HitDef `p2stateno` custom States as well. The consumed contact frame advances StateTime to 1 when defender P2 hit-shake begins; subsequent shake ticks continue StateTime while freezing AnimTime and motion, and ordinarily only `ignorehitpause = 1` controllers execute. For itoko State 1465 this means the nine-frame defender shake advances the borrowed-State clock, so its authored `Time >= 20` VelAdd is already active when Helper 1464 applies `TargetVelSet y = -14`; WebMUGEN no longer adds roughly ten gravity-free launch frames. Attacker P1 pause is distinct and freezes StateTime, as required by itoko's Issue #125 zipper delay. Bundled itoko therefore runs its State -2 `Time = 1` VarAdd once, stores guard-break damage in root `var(25)`, creates Helper 2030, and emits the frame/fill/back Explods 2030/2031/2032 without an engine-side character-specific rule. Its P2 controllers use the legacy spelling `postype = light`, which resolves to the screen-left coordinate system rather than the stage-space P1 fallback, retaining the authored X positions 238/232/238. At 100 points, WinMUGEN also commits the automatic non-Command State -2 ChangeState during GuardHit pause, before the following `ignorehitpause` VarSet can clear the threshold; WebMUGEN mirrors that narrow compatibility path and enters State 2031/Anim 2035. Command-conditioned State -1 routes remain blocked until control is valid.

State 5150 is the lying-dead state and never accepts recovery input. States 5200, 5201, and 5210 are fall-recovery states, not dead states. RoundState supplies `MatchOver`, winner/draw, and the distinct `ko`, `double_ko`, or `time_over` reason to the CNS context. See `common-ko-recovery-5150.md` for the state-by-state contract.

Issue #93 connects the presentation states around that combat result. Both roots enter engine Initialize State 5900 at RoundState 0, preserving the character/common `5900 -> 190 -> 191` first-round route and its variable initialization. Their character-owned 190-199 routes run at RoundState 1 until both have finished or stopped asserting `intro`; a newly pressed mapped game input can end those character Intro states, after which the HUD still presents `ROUND N` and `FIGHT!`. A later round with no selected intro enters controllable State 0 when Fight begins, including StateDefs that omit `ctrl`. Fight input/collision begins at RoundState 2. On KO, the winner immediately loses control and continues character/common CNS without commands until it naturally returns to State 0; only then does the coordinator dispatch State 180. This covers airborne landing State 52 and any character-owned recovery before neutral. The loser remains on the common down route to State 5150. The result presentation timer begins only after the win State is entered. A newly pressed mapped game input during an active result State skips the remaining victory presentation, including `roundnotover`; a held attack from the KO frame is not treated as a new skip. State 170 and draw State 175 remain time-over presentation. After two wins, the application clears the score and automatically starts a new match at Round 1.

The application header owns a persistent Japanese/English toggle aligned at the upper right, outside the game canvas. UI chrome, help, settings, and status labels select one language at a time; character/CNS identifiers and raw diagnostic payloads remain their source-format technical data.

Issue #63 audits the entire accepted-HitDef-to-recovery/KO pipeline rather than treating each State family in isolation. The consolidated invariants, exact StateDef inventory, bundled T-H-M-A State 215 scenarios, and user confirmation boundary are recorded in `common-state-chain-audit.md`.

Issue #64 adds an explicitly non-compatibility Power Infinite runtime setting. Selected root players are normalized to their real `powerMax` at the game-frame boundary before CNS evaluation; ordinary Power controllers, StateDef `poweradd`, HitDef transfers, and later same-frame triggers still observe normal ordered mutations until the following frame. Modes, persistence, reset behavior, HUD marking, and the Helper phase boundary are documented in `infinite-power-settings.md`.

Practice Mode is also an explicitly non-compatibility runtime setting. When enabled, a root player whose Life reaches zero is restored to the current full gauge value immediately before RoundState evaluates KO at the end of that unpaused frame, and the round timer does not decrement. The existing hit reaction, State, animation, velocity, and get-hit snapshot remain intact so the character follows its normal data-driven recovery route; only the KO handoff and time limit are prevented. The setting defaults to OFF and is persisted with the other runtime settings. It does not reopen a round that had already entered the KO phase before the setting was enabled.

The default screen-size setting is an extended Hi-Res viewport: a physical 800x480 Canvas renders 400x240 logical coordinates at 2x. Character `[Size] xscale/yscale` remains inside that transform, so character size is unchanged from classic WinMUGEN while the additional 40 logical pixels on each side prevent the two roots from being clipped at the initial 200-unit separation. The exact physical 640x480 / logical 320x240 classic profile remains selectable, and 960x540 retains the previous broad 1x presentation. Explod/Projectile scale, screen-space positions, stage-space players and Helpers, collision diagnostics, fallback stage drawing, camera centering, and HUD centering use the selected viewport. The two WinMUGEN profiles retain one frame-level camera origin. Built-in stages consume their authored horizontal `tension`: the leading camera-enabled root moves the viewport until its fallback-arena camera limit, where player physics also stops. External stages map the internal world center and ground baseline to Stage camera `0,0`, apply horizontal tension and camera bounds, verticalfollow/floortension, and Bound screen insets, then apply each BG `delta` once in Stage coordinates. External `[Bound] screenleft`/`screenright` normally constrain the player axis, allowing the sprite and Push Box to protrude toward the screen edge as authored; an active tick-scoped `Width edge` pair replaces that axis bar for screen containment. CNS body-edge-distance triggers consume the same Width edge bar and frame camera origin, while `ScreenPos X` uses the axis and that camera origin. This keeps wall-driven states aligned with physics on both paths and makes bundled T-H-M-A State 270 carry P2 to the Stage-end camera limit before State 271 impact. WinMUGEN horizontal camera bounds are defined for a 320-wide coordinate viewport, so the 400-wide profile insets the parsed left and right limits by 40 while the classic profile preserves them exactly. The extended view therefore remains inside the same stage image coverage at either camera limit instead of exposing black edges or stretching the art. Changing the profile reloads the current character/match so CNS `screenWidth` and screen-space controller evaluation cannot mix dimensions within one run. Exact camera hysteresis, PlayerInfo spawn/bounds, negative Width values, and broader non-root edge ownership remain Partial.

Issue #107 retains the preceding legal horizontal camera on the legacy tension-less path when two root Push Boxes become wider than
the usable viewport. The subsequent ScreenBound correction applies only to the root outside that
fixed view, preserving the stationary opponent's world X and both players' velocity. Focused tests
cover sustained P1-left and P2-right retreat in the 400x240 extended viewport on built-in and external
Stage paths.

When every root and Helper disables a camera axis through `ScreenBound movecamera`, the application
retains the preceding coordinate for that axis rather than repopulating the follower set with roots.
This lets bundled T-H-M-A States 3730/3735/3738 visibly lift both players and the ground Helper while
their authored `movecamera = 0,0` keeps the frame fixed.

HUD and stage appearance are independent runtime settings. The bundled `Fresh`, `Cyber`, `Fresh Classic`, and `Cyber Classic` variants share the same life/power values and game coordinate viewport; only presentation changes. Their WinMUGEN-compatible 320/400x240 profiles render the authored world without a visual-floor displacement. The WebMUGEN-only 960x540 profile uses a fixed 180-coordinate offset derived from the authored ground Y=285 and its lower-screen presentation target; it never derives that offset from a root's current Y or StateType. All related stage-space entities receive the same fixed offset. Consequently, standing-typed special states remain free to move vertically and T-H-M-A State 3730/3735 is not pinned to the lower screen. Native Stage horizontal bounds, `tension`, and `verticalFollow` now participate in the shared-player camera calculation. Fresh and Cyber restore full horizontal bounds with separate wide panoramas. Fresh uses 0.12 distant movement and Cyber uses 0.10; both arena floors use full camera movement, and each transition region continuously blends those factors so there is no hard horizontal seam. Both retain zero vertical follow. Cyber Classic also uses zero vertical follow so jumping does not move its camera or floor vertically. Cyber Classic uses a procedural perspective grid with a viewport-centered initial vanishing point; after match start, its vanishing point and floor endpoints translate by the full horizontal camera delta. It renders neither the former front-image rectangle nor the distant-building layer. External stages bypass the visual-floor adapter and retain their DEF-defined ground/camera mapping. The fixed life/power/timer HUD pass runs after the stage and before Projectiles, players, Helpers, Explods, and hit feedback, matching the requested behind-character presentation. `ROUND`, `FIGHT!`, KO, and time-over presentation uses a separate foreground pass after character/effect drawing so sprites cannot cover the announcement text. Both power gauges sit directly below their corresponding life gauges, align to the outer screen edges, and use half the former width; score labels continue below them. Timer placement derives from the HUD viewport center rather than fixed 960-wide coordinates. The main game Canvas uses browser-quality final scaling for Canvas text while sprite draws continue to disable smoothing internally.

The external stage option loads a MUGEN stage ZIP through the application loader and renders its SFF v1 background. The compatibility slice parses the first DEF, `[BGDef] spr`, `StageInfo hires/zoffset`, Camera/PlayerInfo/Bound fields, and static `type = normal` BG layers with `spriteno`, `start`, `delta`, and `layerno`. Hi-Res sprite coordinates cover the full selected 2x viewport. `HiRes = 1` keeps DEF BG starts and SFF axes in their source coordinate space, then applies authored `delta` to low-resolution Stage camera movement. `zoffset` aligns the gameplay ground and camera but is not part of the BG top-center-relative position. For the bundled beach, the sky begins at Y -220 at rest and reaches Y 0 exactly at `boundhigh = -110` through `delta.y = 2`; the floor overlay begins at Y 264. The extended profile also narrows the usable horizontal camera range by the extra 40 coordinates on each side, so the same BG remains flush with the 800-pixel viewport at both limits. Animated BG controllers, tile/window clipping, layer 1 foreground separation, exact spawn/player bounds, shadows/reflections, and music remain unsupported.

Issue #65 routes `target(ID)` through the accepted-HitDef Target registry rather than treating its argument as StateNo/runtime entity id or falling back to self. The T-H-M-A 1015 -> 1016 path is covered with `PrevStateNo`, accepted `MoveHit`, redirected target `MoveType=H`, repeated-trigger AND aggregation, and terminal ChangeState. Its controller requests `ctrl=1`, then the explicit State 1016 header supplies the final `ctrl=0`; miss, guard, missing-id, and wrong-previous-State cases remain out of the route.

Issue #66's State extraction found that 3405 owns two transitions to 3415: `AnimTime=0` plus redirected enemy hitcount 0..17, or `Time=1` plus hitcount >=18. State 3415 itself has no transition to 3405; its two terminal routes require `StateType=S/A` AND `Time=10` and go to 102/6140. Therefore any observed 3415 -> 3405 is a negative-State CMD/AI re-entry, not a 3415 current-State controller.

The common redirect layer now keeps bare/indexed enemy selection, child evaluation context, and SFalse failure observable and consistent. Bundled AIR/CNS tests verify the finite 5-tick Action 3405, entry to 3415, HitDef activation/retention, ten StateTime ticks in 3415, and the normal State 102 exit for P1/P2. No fixed hold time or state-number runtime branch is used; all timing comes from the character AIR/CNS.

## Good next runtime improvements

- richer controller execution tables;
- cleaner trigger group diagnostics;
- previous-state ownership beyond the verified root-player ChangeState path;
- Helper and animation ownership beyond the implemented HitDef/TargetState/SelfState CNS owner ids;
- runtime events for HitDef/contact lifecycle.

## Explod creation runtime

`GameState.explods` is the durable match-level collection. `CnsStateRuntime` emits frame-local owner-scoped creation snapshots; the app coordinator allocates the internal runtime id and appends the entry before Runtime History capture. A MUGEN `id` is selection metadata and may be duplicated; it is never used as the internal identity.

Issues #30-#39 connect the baseline Explod collection, render, lifecycle, mutation, removal, and binding paths. Issue #34 additionally samples creation random through an injectable source, integrates non-bound world velocity before acceleration, applies scale and additive source alpha in Canvas, and removes `removeongethit` entries after owner hit resolution but before same-frame rendering. Issue #35 freezes the whole Explod tick during Pause/SuperPause and consumes the matching per-entry move-time allowance before an allowed tick. Default `bindtime=1` holds position for the creation tick and releases before later movement. Ownpal isolation, destination alpha/subtractive blend, shadow rendering, and non-player owners remain Partial.

Issue #36 converts each unprocessed HitEvent spark into a `hit-spark` entry after collision and before same-frame Canvas rendering. It reuses Explod AIR timing/removal/rendering but remains outside controller MUGEN-id selection, so `RemoveExplod id=0` cannot remove a contact effect accidentally. The same coordinator resolves the selected hit/guard sound sample and emits a channel-less SoundPlayEvent to the shared Browser Audio bridge. Runtime-integrated flags make a repeated coordinator call idempotent.

Issue #51 separates character/asset loading from live runtime startup. A prepared game-loop closure remains dormant behind the canvas Audio Start Gate until a direct pointer/key gesture makes the shared AudioContext report `running`, or the user explicitly chooses no-audio continuation after failure. BrowserInput and requestAnimationFrame are created only inside that once-only closure, so the first PlaySnd/HitDef sound cannot precede audio unlock on the normal audio-enabled path.

The requestAnimationFrame scheduler keeps a fractional target-time cursor rather than replacing it with every observed timestamp. This prevents the normal `1000 / 60` interval from falling to every other RAF callback because of sub-millisecond timestamp rounding, while still carrying slower custom intervals forward and resynchronizing after a long inactive-tab gap.

`GameState.pause` is the match-level Pause/SuperPause clock. The activation CNS pass emits one owner-scoped event; subsequent paused passes skip negative and current State controllers for non-moving entities. The controller owner continues State processing, animation, Controller evaluation, collision eligibility, and physics for its `movetime`; other players, round time, hit resolution, and physics remain frozen. `time = movetime = 12` therefore counts 12 activation-inclusive frames for the owner and zero moving frames for the opponent. HitOverride clears the overridden player's inherited P2 hitpause while retaining the attacker's P1 hitpause, then executes the destination's Time=0 Controller pass during collision entry. T-H-M-A State 902 can therefore start Pause and PosFreeze on contact and remain owner-active instead of being stopped by the incoming HitDef pausetime. A one-frame resume guard prevents activation-side-effect replay after Pause ends. Canvas rendering consumes the same state: an active SuperPause with `darken` enabled darkens regular layers while leaving hit feedback and `ontop` Explods above the darkening pass. Same-pass events emitted by another player before the coordinator applies the pause remain a documented Partial boundary.

## AfterImage runtime

Issue #81 replaces the recognized no-op with durable player frame history. After physics and hit processing, movable entities capture their displayed position, facing, Anim number, Anim time, and resolved AngleDraw angle/scale at `timegap`; the renderer selects every `framegap` entry, draws oldest first immediately behind the owner, and reapplies the historical transform and controller's `trans` composition. `raw.afterimage_draw` exposes capture/display/draw counts, duration, gap values, composition, and the diagnosed Canvas palette approximation.

## BGPalFX runtime

Issue #81 replaces the `BGPalFX` safe no-op with a match-level timed state. Controller execution evaluates `time`, `color`, `invertall`, `add`, `mul`, and `sinadd`; later frames advance the retained clock without rerunning the controller. Canvas scopes the calculated filter to `drawStage`, including external SFF stages, so the Stage image remains present while its colors change; players, Helpers, Explods, feedback, and HUD remain unaffected. `AssertSpecial noBG` is separate and intentionally suppresses Stage drawing when character data requests it. The Canvas CSS backing is solid black, preventing the former gray/green presentation gradient from leaking through the cleared transparent bitmap during `noBG`. Exact RGB-channel palette math, WinMUGEN lifebar palette coverage, and `ignorehitpause` controller activation remain Partial.

## Helper HitDef runtime

Issue #81 includes existing Helpers as attack candidates after the root-player priority pass. Issues #117/#119 extend the same collision path to Helper defenders and Helper-vs-Helper contact. HitDef consumption uses each Helper's unique runtime entity id even though character/state ownership remains rooted. `affectteam` selects enemy, friendly, or both entities for E/F/B. Same-frame Helper priority clashes and team partners remain Partial.

Issues #118/#124/#127 make redirected root input and Power ownership explicit. `root, Command` switches to the redirected root command set even for a `keyctrl = 0` Helper, while bare `Command` still uses the Helper's own input availability. Helpers read and mutate their root's shared Power gauge; multiple Helper writes are processed in runtime order.

Issues #120/#126 retain the preceding camera when enabled roots cannot fit in one viewport, then clamp only the escaping root axis. Default ScreenBound containment uses the player axis; an explicit Width edge remains authoritative. This lets current-viewport edge triggers fire without carrying a bound victim to the Stage limit.
