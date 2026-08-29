# State Controller Executor

Updated: 2026-07-30

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

## Common controller parameters

`persistent = 0` allows a Controller to execute only once during one stay in its StateDef, even if
its Trigger remains true on later ticks. The execution latch is cleared when that StateDef is entered
again. This is required by the bundled T-H-M-A juggle display: its `VarAdd` must add each attack's
configured cost once instead of adding it on every frame while the target remains in `HitFall`.

Omitted `persistent` retains the default value 1 and executes whenever the Trigger passes.
The `persistent = N` cadence for values greater than 1 remains Partial.

## Controller categories

### Basic state mutation

Examples:

- `ChangeState`
- `SelfState`
- `CtrlSet`
- `StateTypeSet`
- `MoveTypeSet`

`StateTypeSet` updates remain active while the current State continues. StateDef `type` and
`physics` are entry fields and are not reapplied on later ticks; this is required for airborne
routes authored from a standing StateDef, including T-H-M-A State 3410.

These mutate state identity or state flags.

`PowerAdd` and `PowerSet` mutate the current player's durable Power through the shared 0..powerMax clamp. StateDef `poweradd`, TargetPowerAdd, and HitDef getpower/givepower use that same path so a character limit such as 9000 is not silently reduced to 3000. Each controller mutation emits a `raw.power` diagnostic. Helper ownership remains Partial.

`ChangeState` preserves the current State owner. `SelfState` resolves the player's `selfStateOwnerId`, enters that owner's CNS document, and clears borrowed ownership. In an ordinary StateDef, a successfully executed ChangeState or SelfState terminates that StateDef's remaining controller list; the entered State may then execute on the same frame. Negative common command states retain their existing entry-snapshot scan semantics. Helper/animation ownership remains Partial.

`ChangeState ctrl` updates the transition input before the destination StateDef is entered. An
explicit destination `ctrl` header overrides it in the same frame; when the destination omits
`ctrl`, the controller value is inherited. T-H-M-A State 6000 -> 60001 is the focused regression:
the source requests `ctrl = 1`, but destination `ctrl = 0` is final and State -1 cannot route the
next held direction into State 20 or 11.

`AssertSpecial` retains all values supplied through `flag`, `flag2`, and `flag3` as case-insensitive,
per-game-tick player flags. They survive later Controllers and ChangeState in the same CNS pass, then
clear at the beginning of the next CNS tick unless asserted again. `noautoturn` is connected to the
grounded State 0/11 idle (`MoveType = I`) AutoTurn rule; other States preserve Facing unless `facep2` or `Turn` explicitly changes it. The flag also remains
effective across a same-tick ChangeState. `invisible`, the three guard-prohibition flags, attacker-local
`unguardable`, `nojugglecheck`, `noBG`, and `nobardisplay` are consumed by Canvas, guard, juggle,
stage, and HUD paths without deleting the entity or forcing a State. `noBG` intentionally suppresses
the Stage pass and exposes a black Canvas backing rather than a presentation-theme gradient; it is independent of `BGPalFX`, which filters but retains external Stage imagery. `intro` synchronizes character
intros, and `roundnotover` delays the automatic next-round restart while a victory State asserts it.
Timer/audio/shadow/noFG/nowalk consumers and exact hitpause persistence remain Partial.

`Gravity` adds the current character's `[Movement] yaccel` to Y velocity once per Controller
execution. It is independent from `Physics = A`, so multiple explicit Gravity Controllers and the
automatic air-physics step remain separately observable.

`ScreenBound` stores tick-scoped `value` and `movecamera` X/Y state. The application camera consumes
the root players' X/Y flags in the 320x240 and extended 400x240 WinMUGEN viewports. Normal ticks
permit both-axis camera movement; an executed Controller uses its explicit `movecamera` pair for that
tick. If every entity disables one camera axis, that axis retains its preceding camera coordinate
instead of silently falling back to the root players; this is required while bundled T-H-M-A States
3730/3735/3738 lift both players and the ground Helper with `movecamera = 0,0`. `Width` evaluates separate front/back `edge` and `player` pairs for one tick; `value` is shorthand
for assigning the same pair to both. The edge pair feeds screen containment and body-edge triggers,
while the player pair feeds player-to-player pushing. A player with `value = 1` is shifted, without
clearing velocity, until its Width edge bar (or default Size-derived bar) is inside the horizontal camera edges. `value = 0` bypasses both the fallback stage clamp and this
viewport clamp. Native WebMUGEN stages with an authored `tension` follow the leading camera-enabled
root until the Stage camera bound, then shift any other enabled root that would leave the viewport;
this keeps `FrontEdgeBodyDist`/`BackEdgeBodyDist` wall impacts aligned with the Stage end. On the
legacy tension-less path, if the two root Push Boxes cannot fit simultaneously, the last legal camera
position is retained within their incompatible containment limits and only the root beyond that fixed
edge is shifted. External stages supply their DEF camera bounds, tension, vertical-follow/floor-tension,
and Bound screen insets to this path. Negative Width values, Helper/custom-state ownership, exact hysteresis, and PlayerInfo
spawn/bound enforcement remain Partial.

`DisplayToClipboard`, `AppendToClipboard`, and `ClearClipboard` maintain a per-player debug buffer.
The runtime supports six evaluated parameters, integer/floating/exponential formats, `%%`, and common
escapes, and Physics Debug Overlay shows each player's retained buffer. `ForceFeedback` emits a
normalized owner/waveform/time/amplitude/frequency request; the app maps it to a connected browser
Gamepad dual-rumble actuator and safely ignores missing/rejected hardware. Physical-device behavior,
player-to-pad assignment, disconnect cancellation, and waveform parity remain manual/incomplete.

`PalFX` creates a timed player-scoped palette state using `time`, `add`, `mul`, `sinadd`,
`invertall`, and `color`; Canvas applies the same documented filter approximation already used by
HitDef PalFX. `AllPalFX` emits the same normalized state for both root players and the stage.
`AngleSet`, `AngleMul`, and `AngleAdd` evaluate `value` in the current entity's CNS context, including
Var/FVar expressions. `AngleDraw` enables the tick-scoped transform; a following `AngleSet`,
`AngleMul`, or `AngleAdd` in the same State pass updates the angle rendered for that tick instead of
leaving a one-frame-old snapshot. Entering another State clears the preceding State's tick-scoped
draw angle and scale. Canvas receives the final angle and X/Y scale without rotating collision boxes.
Canvas follows WinMUGEN's facing-relative convention: a positive
angle is counterclockwise while facing right and mirrors with Facing. AIR element offsets remain
outside the rotation: AngleDraw scale affects the offset, then Canvas rotates the sprite around its
offset-adjusted SFF axis. Bundled itoko Action 106 depends on this order for its back-dash somersault;
States 52 and 1210 cover AngleDraw-before-AngleSet landing and rubber-belt ordering.
`EnvColor` stores a timed RGB overlay and honors `under` by placing it below or above ordinary character/effect drawing. Legacy `GameMakeAnim` and `MakeDust` emit common `fightfx` animations through the shared Explod lifecycle (`MakeDust` uses Action 120 and supports both `pos` and `pos2`). The bundled app lacks common fightfx AIR/SFF assets, so missing actions remain diagnosed safe skips. `Zoom` is a MUGEN 1.1 Controller and is outside the WinMUGEN 2002.04.14 target.
`AssertSpecial invisible` now reads the canonical tick flag list directly in the renderer.

### Motion and position

Examples:

- `VelSet`
- `VelAdd`
- `VelMul`
- `PosSet`
- `PosAdd`

`PlayerState.vx` is stored in world coordinates and position integration adds it directly to world X. `VelSet`, `VelAdd`, and `PosAdd` therefore multiply CNS X values by the player's current facing once when the controller executes. `VelMul` scales the already converted world velocity and must not apply facing again. `Turn` flips both Facing and the stored world X velocity: MUGEN exposes `Vel X` in Facing-relative coordinates, so the authored relative velocity remains unchanged while its screen direction reverses. This is required when bundled T-H-M-A State 3937 turns the target at the wall with the preceding State 3935 velocity still active. `PosSet` converts its screen-center-relative X through the current frame camera center (`cameraX + screenWidth / 2`) into internal world X, and converts MUGEN Y to the internal stage baseline. Trigger `Pos X` performs the inverse conversion, so `PosSet x = Pos X` preserves world position even while the camera scrolls. Both position controllers evaluate parameter expressions with the current player/opponent context, including redirects such as `Enemy(0), Pos X`. Bundled T-H-M-A State 3110 uses this sequence to turn, copy the live opponent position, and apply a Facing-relative offset behind that opponent. If parameters are expressions, parser/evaluator support must be verified before marking broad compatibility.

### Animation

Examples:

- `ChangeAnim`
- `ChangeAnim2`

`ChangeAnim` is runtime animation selection. Its `value` parameter is evaluated through the CNS numeric expression evaluator, so expressions such as `ifelse((vel x)=0,44,45)+var(5)*4` can use the current player velocity and variables. `ChangeAnim` uses the entity's self AIR/SFF owner. `ChangeAnim2` records the current custom-State owner for AIR lookup, but Canvas resolves the resulting AIR element's group/image from the animated player's self SFF owner. This WinMUGEN ownership split keeps T-H-M-A Darkness Finger Shinuchi State 3425 on the victim's own `5002,*` sprites instead of replacing the victim with T-H-M-A artwork. `SelfState` restores self animation ownership.

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

Issues #30-#39 connect Explod creation, rendering, lifecycle, mutation, removal, and binding. Random displacement, velocity/acceleration, scale/Facing/vfacing, additive and subtractive Canvas rendering, removal on owner hit, owner-scoped IDs, Pause allowances, equal-priority creation order, and Helper ownership are covered by focused and real-character tests. At equal priority, an Explod is queued behind the older root-player sprite; this keeps T-H-M-A State 3640's full-screen Action 3603 background from covering the State's Action 3640 player animation. Issue #109 aligns screen-edge origins with WinMUGEN: Explod `front/back/left/right` positions use viewport-edge X and viewport-top Y, with positive X following each postype's documented direction (`right` points left). Issue #131 additionally preserves WinMUGEN's legacy `light` spelling as the screen-left enum; bundled itoko uses it with P2-authored X coordinates 238/232/238 for Helper 2030's guard-break gauge. Helper screen-edge postypes retain their separate P1-axis Y semantics before conversion to world coordinates. Screen coordinates are converted exactly once, while bound stage-space Explods receive a final post-physics/Stage synchronization. Duplicate non-trigger Controller parameters retain their first value, keeping T-H-M-A State 3630's Action 3603 red full-screen background at `postype = back` beneath its subtractive Action 3635 purple lightning instead of overwriting it with the later stale `postype = p1`. Bundled T-H-M-A State 3940 verifies that Actions 3941/3942 are created at screen `(0,30)` rather than below the viewport. The 320x240 and extended 400x240 profiles share those logical rules before their physical 2x render. For extension widths above WinMUGEN's authored 320 coordinates, evenly tiled groups of at least three same-frame Explods are completed at exposed viewport edges without changing their runtime entries; this keeps T-H-M-A State 3169's Action 18200 frame closed after its owner leaves the camera. Ownpal uses the existing owner asset scope but independent palette mutation is unverified; destination alpha, shadow pass, implicit effect cleanup when an owner disappears, and exact camera tension remain Partial. See `explod-integration-design.md` for the remaining boundaries.

Issue #124 distinguishes regular and `ontop` Explod tie ordering. Regular equal-priority Explods keep the older entry in front. The `ontop` layer instead bypasses `sprpriority` and follows reusable Explod allocation-slot order, with later slots drawn in front. Initial creation therefore composes bundled itoko's power-gauge underlay 2221, blue bar 2225, combined frame 2200, and portrait 2230 in that order. Issue #125 verifies that spending and restoring Power removes/recreates 2225 into its freed slot rather than moving it after the frame and portrait; internal diagnostic `runtimeId` remains monotonic and distinct from the reusable draw slot.

`Projectile` is connected to the production CNS/app path. Controller execution creates a Facing-relative runtime projectile, `velocity`/`accel` advance it, `projanim` renders from owner AIR, `projscale` affects rendering and collision, `projremovetime` expires it, and the initial AIR Clsn1 bounds drive contact/removal. Projectile contact shares ordinary HitDef target eligibility, including KO rejection, HitBy/NotHitBy filtering, and H/L/M/A/F/D hitflag classes. A newly created Projectile is eligible to contact a defender during existing HitPause; the new contact's own pause data then replaces the defender pause. Projectile contact history remains keyed by `projID`, while an acquired Target is keyed by the HitDef `id` when present and falls back to `projID` when omitted. This is required by bundled itoko State 3005 -> 3006: the first Projectile holds P2 in State 5070 with `pausetime = 0,100`, while the follow-up with omitted `projID` and `id = 3066` must hit after 25 attacker ticks and remain selectable by `TargetState id = 3066` for the State 3007/3010 zipper-close route. In particular, T-H-M-A State 1005's `hitflag = MAF` ignition shockwave cannot hit a lying `StateType = L` target; a `D`-enabled Projectile uses the down reaction and cannot be guarded while lying. Normal and `guardflag`-approved contacts update attacker `MoveHit`/`MoveGuarded`, apply explicit `getpower`/`givepower`, and select the matching spark/sound. A launched hit preserves the velocity, hit-time, fall, and `yaccel` snapshot required by common States 5030/5040. On a removing hit, `projhitanim` replaces the live projectile animation and disables further collision. Opposing projectiles now resolve intersecting Clsn boxes through `projpriority`; exhausted entries are removed and both owners receive ID-specific and ID-0 `ProjCancelTime` history. HitDef `palfx.time/add/mul/sinadd/color/invertall` are snapshotted and normal hits apply a timed defender-only Canvas filter; this is the burning palette route used by bundled T-H-M-A State 1005. Exact per-channel palette arithmetic, animated Clsn changes, advanced `projremove`/`projhits`, guard/cancel animations, and Pause/SuperPause parity remain Partial.

Projectile hit history also supplies `ProjHitTime(id)` to later CNS passes. During HitPause, the State runtime evaluates only Controllers whose `ignorehitpause` value is nonzero. This permits bundled T-H-M-A State -2 to create its four P2-bound fire Explods while the impact is frozen; `NumExplod(id)` reads committed entity-owned Explods and prevents recreation on the following paused frames.

An accepted non-guard Projectile hit now registers its live defender in the root owner's Target list with the HitDef `id` (or the Projectile ID when omitted) and hit snapshot generation. This keeps the target available after Projectile removal and owner HitPause. Old-style `ProjHit<ID>` can therefore fire `TargetState` from the attacker's current or special State, enter the defender into the attacker's CNS document, continue through attacker-owned `ChangeState` transitions, and return through `SelfState`. Guard, miss, and already-KO/removed-target paths do not create a new Target; an acquired Target remains selectable if later damage reduces its Life to zero so a custom KO sequence can finish and release it.

The common Target controllers now resolve the attacker's registered Target entries, optionally filtered by HitDef `id`, and mutate the matching player rather than assuming P1/P2 roles. `TargetVelSet`, `TargetVelAdd`, `TargetLifeAdd`, `TargetPowerAdd`, `TargetFacing`, `TargetState`, `TargetBind`, and `TargetDrop` are connected. Target velocity X is expressed in the selected target's Facing coordinates and is converted once when applied; it is not relative to the root or Helper that executed the controller. Bundled itoko Helper State 1464 therefore converts `TargetVelSet x = -0.5` on left-facing P2 into world `vx = +0.5`, carrying P2 toward the right side and allowing the WinMUGEN camera response seen in Issue #133. `TargetLifeAdd` applies the owner's attack multiplier and target's defense multiplier unless `absolute = 1`; `kill = 0` preserves one Life. A non-finite stored multiplier falls back to 1 so it cannot poison Life with `NaN`. A missing target is a diagnosed safe no-op, and `TargetDrop` prevents later Target controllers in the same State pass from finding the removed entry. A queued Target mutation is also exposed to later redirect triggers in that same State pass, including the `Time = 0` controllers of a destination entered by a following `ChangeState`. Bundled itoko State 3006 depends on this ordering: `TargetState id = 3066` enters P2 into State 3007 before P1 State 3010 tests `target,stateno`. Helper-owned Target operations retain the unique runtime Helper id, so State 3735 TargetBind follows the rock rather than the root, and patterns such as `TargetState value = 3738` followed by `target(3725),stateno = 3738` can advance the Helper immediately. Because Helpers execute after both roots, a Helper-issued `TargetState` explicitly runs the destination root's `Time = 0` pass before physics; otherwise its initial `Turn`, `VelSet`, and similar controllers would be skipped when StateTime advances.

Issue #58 Phase1 connects `Helper` and `DestroySelf` to an independent runtime entity collection. Runtime entity IDs are unique and separate from duplicate-capable MUGEN Helper IDs. Each entry records root, parent, character/State/animation owner, requested State and Anim, creation `size.xscale`/`size.yscale`, separate `pausemovetime`/`supermovetime` allowances, and an independent PlayerState snapshot. A Helper's initial sprite priority is `0`, or the initial StateDef's explicit `sprpriority`; the parent's live priority is not copied. A same-priority newly-created Helper is drawn behind the older root players, which keeps T-H-M-A State 3201's cut-in portrait at the back. Size scale reaches owner AIR/SFF rendering and Size-derived collision geometry. Spawn requests commit after the current controller evaluation and begin normal State execution on the next frame, preventing recursive same-frame generation. Destroy requests commit before later physics/rendering. Round restart clears entries and resets the allocator. The later special-State Phase 1 restricts ordinary Helpers to their current State and permits State -1 only with `keyctrl = 1`; State -3/-2 remain root-only. BindToParent/Root resolve unique runtime entities and retain finite or indefinite facing-relative bindings; BindToTarget selects the registered target id and Foot/Mid/Head anchor. ParentVarSet/Add commit validated var/fvar mutations to the immediate parent rather than assuming root. Issue #109 converts Helper `front/back/left/right` viewport origins to world coordinates with the current camera X/Y exactly once and inherits Facing from the selected origin; P1/P2 origins remain stage-space. Issue #81 connects active Helper HitDefs to the opposing root's Clsn2 and returns damage/reaction plus Helper-local HitPause, MoveHit, consumed-target, and Target state. Issue #117 extends collision identity to Helper defenders and Helper-vs-Helper contact, including entity-local HitOverride routing. Pause/SuperPause gates use the unique Helper runtime id and allow a non-owner Helper to advance CNS, physics, and animation while its matching per-Helper allowance is consumed. Exact bind update timing during Pause, child-destruction policy, push interaction, palette mutation, and advanced team/priority ordering remain Partial; see `helper.md`.

Normal Helpers start with `ScreenBound value = 0` and `movecamera = 0,0` instead of inheriting the root's camera flags. A Helper's own tick-scoped `movecamera` can opt it into horizontal or vertical camera calculation independently. Active Helper HitDefs normalize `affectteam` to E/F/B with E as the default; E selects enemy entities, F friendly entities, and B both. Helper defenders and Helper-vs-Helper collision retain unique runtime identities so per-target consumption and HitOverride do not alias the owning root. Team partners, Projectile parity, and advanced multi-target ordering remain Partial.

`TargetState` assigns the controller owner's stable root player id as the target's State-document owner and also records the unique root or Helper controller entity. This matches HitDef `p2stateno` with `p2getp1state = 1`; redirects in the borrowed State use the supplying entity's Root/Parent relationships, while `SelfState` returns the target to its own document and clears that entity ownership. Issue #120 verifies Helper 1462's real State 1465 `root,movetype = H` abort route. Root targets selected by a Helper are covered; Helper-as-target, animation ownership, teams, and multi-player targets remain Partial. `TargetBind` immediately applies the Facing-relative position and owner velocity, then repeats that synchronization after entity physics for every effective bind tick, including the tick that reduces a finite duration to zero. Stage clamping and push receive the same final correction before the expired metadata is cleared. Omitted `time` lasts one tick, zero cancels a bind, and any negative value is normalized to indefinite; `TargetDrop` also clears a bind owned by the dropped target owner. A finite duration freezes while the controller owner is in P1 pause, but target-only P2 hit-shake still consumes it. Issue #125 verifies both itoko's two-tick opening release, Projectile 3066 launch arc, and the final one-tick ground bind that clears the scripted downward velocity before P2 returns through its own State 5120. Exact global Pause/movetime combinations, Helper-as-target/team/multi-player ownership, and mixed coordinate-space scaling remain Partial.

`AttackDist` mutates the current ActiveHitDef's live guard distance; it never forces the opponent into a guard State. `HitOverride` retains eight timed, replaceable attribute slots and intercepts matching accepted contact before normal damage/reaction, entering the configured self-owned State and optionally forcing air StateType. Positive `time` values expire per active tick, while WinMUGEN's `time = -1` remains active indefinitely. Although normal damage and common reaction are suppressed, WinMUGEN still snapshots the incoming HitDef into `GetHitVar`; `forceair = 1` selects the air velocity/hittime values for that snapshot. This is required by T-H-M-A interrupted Shinuchi State 3970, whose `VelAdd y = GetHitVar(yaccel)` must begin falling and eventually enter State 5100 instead of remaining at zero Y velocity forever. Attribute filters accept WinMUGEN's `AA`/`AP` Any-class forms: the `A` class matches normal/special/hyper attacks with the requested attack/projectile suffix, but does not match throws. The attacker retains the HitDef P1 pausetime, while the overridden player clears the inherited P2 hitpause before entering the destination State. External collision entry then applies both the destination StateDef header and its Time=0 Controllers in the contact frame. Real T-H-M-A State -1 blocking therefore selects State 902's Random-based Anim 902/905/908, starts `Pause time=12 movetime=12`, applies `PosFreeze`, BGPalFX, NotHitBy, and ReversalDef immediately, advances State/animation time without moving position, and emits its Time=1 PlaySnd on the following owner-active frame even when the incoming HitDef specifies a nonzero P2 pausetime. Real itoko bag Helpers use `time = -1`; their mutual contact now enters State 1102 instead of falling through to common hit State 5020 and drawing an extra itoko sprite. `ReversalDef` is a separate attack-vs-attack path: both Clsn1 sets must intersect, `reversal.attr` must match the incoming HitDef, then p1/p2 State and pausetime are applied, the incoming HitDef is consumed, a Target is registered, and `MoveReversed` becomes observable. Projectile external-entry target operations and rare priority behavior remain Partial.

HitDef `p1stateno` enters an attacker-owned State. Its first CNS pass applies the destination StateDef entry fields; an explicit `anim` restarts at time zero rather than inheriting the contact animation's elapsed time. Bundled itoko State 700→710 verifies this custom-throw timing. When `p2stateno` is present, omitted `p2getp1state` follows the WinMUGEN default of 1 and borrows the attacker document; explicit `p2getp1state = 0` keeps the target's own document. `forcestand` changes the target StateType without changing ownership. On a successful non-guard hit, nonzero `p2facing` sets the defender Facing relative to the attacker's current Facing: WinMUGEN real-machine verification from Issue #114 shows that `1` means opposite to P1 (`P2.facing = -P1.facing`) and `-1` means the same direction (`P2.facing = P1.facing`). This is independent of the fighters' world-coordinate order and intentionally differs from some secondary documentation. Missing owner documents or State numbers remain safe and produce `raw.custom_state` diagnostics instead of falling back to a different character's CNS. Bundled T-H-M-A State 700 verifies that a defender without a local State 711 still executes the attacker's State 711 header, while State 3030 verifies `p2facing = 1` followed by the custom State 270 `Turn`/`VelSet` carry route.

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

The controller runtime evaluates PlaySnd every frame, while `AnimElem = N` follows WinMUGEN's finite-action timeline: it fires on the first pass and does not restart merely because the AIR display loops. Authors that intentionally need another sound at the end of a finite loop must express that retrigger in CNS (for example with `AnimTime = 0`). The event bridge and Browser Audio runtime still permit the same sample on distinct frames when its controllers do fire.

Issue #51 makes the first gesture atomic from unlock request through the following sound bridge: one pending `resume()` is shared, and PlaySnd or HitDef sound emitted before it resolves waits for that attempt. There is no unbounded pre-gesture queue, failed resume remains retryable, and Runtime tab changes do not recreate or subscribe the adapter.

Issue #81 connects `AfterImage` to player frame-history capture and Canvas rendering. `length` caps the saved frame buffer, `timegap` controls saving, `framegap` selects the first, fifth, ninth, and subsequent entries at its default value of four, and `trans` controls composition. `AfterImageTime` changes capture duration; setting zero stops new capture while the saved trail ages out instead of deleting it immediately. Each captured frame retains AngleDraw angle/scale, and Canvas reapplies that historical transform around the AIR-offset-adjusted sprite axis without rotating the AIR displacement. ImageData sprites now follow WinMUGEN's RGB palette order: color level, invert, bright, contrast, postbright, then repeated add-before-multiply for older displayed images. `add`/`add1` use additive composition. Exact indexed-palette rounding, external bitmap palette mutation, subtractive blending, and broader pause verification remain Partial. `raw.afterimage_draw` reports captured/displayed/drawn counts, gaps, composition, and the palette path.

Issue #81 connects `BGPalFX` as a match-level, background-only effect. `time`, `color`, `invertall`, `add`, `mul`, and `sinadd` are evaluated when the controller fires; the app retains the duration and the renderer applies the resulting filter only around the stage pass. The Canvas approximation applies `invertall` before color and multiply/add processing, matching the WinMUGEN ordering needed by bundled T-H-M-A State 3169 (`invertall = -1`, `mul = 0,0,0`) to end black rather than white. `raw.bgpalfx_draw` reports the owner, remaining time, source values, and Canvas approximation. Exact per-channel palette arithmetic and activation during hitpause remain Partial.

`Pause` and `SuperPause` emit match-level events. `time` starts on the Controller execution frame. The owner may continue State processing, animation, Controller evaluation, collision eligibility, and physics for `movetime`; other root CNS and physics stop, including negative States. Equal `time`/`movetime` keeps the owner active throughout the Pause. Explods use their own matching allowance. PlaySnd on an activation pass fires once, then controller suppression plus the resume guard prevents replay. Existing browser voices continue through the pause. A SuperPause with `darken = 1` draws a half-opacity black screen pass after regular layers and before hit feedback/`ontop` Explods; normal Pause and `darken = 0` do not. Same activation-pass cross-player ordering, Helper ownership, default SuperPause anim/sound/pos, and other presentation details remain Partial.

If the controller only stores a field or is skipped safely, mark Partial.

## Complete vs Partial

`Null` can be Complete because explicit no-op is the intended behavior.

`AfterImage` remains Partial because ImageData sprites use channel-preserving arithmetic but exact indexed-palette rounding, external bitmap palette mutation, and every pause/subtractive interaction are not yet verified.

`HitDef` is Partial. When the controller activates, the live CNS runtime evaluates and freezes a typed `ActiveHitDef` snapshot containing attr, damage, ground/air/fall animation types, hit/guard flags, priority, hit/guard pause, ground/air/guard types, hit times, velocities, major fall fields, id/chain fields, `hitonce`, kill/power/numhits, five cornerpush variants, snap, and P1/P2 sprite priorities. Numeric CNS expressions and parameter pairs are evaluated with the activation-frame player/opponent context. Parameter punctuation and whitespace follow WinMUGEN's ASCII syntax: a Shift-JIS full-width comma is retained inside the value and a full-width trailing space remains part of an enum token. Thus T-H-M-A State 232 neither applies the text after its full-width comma as Y launch velocity nor accepts `back　` as `animtype = back`; it falls back to the grounded Light/High reaction instead of holding the one-frame Anim 5030 throughout HitPause. Every successful controller execution creates a new ActiveHitDef generation, including repeated AnimElem activations from the same controller. Generation activation preserves the prior MoveContact/MoveHit/MoveGuarded result; the next accepted hit or guard replaces it, while State-local HitCount is retained. A `p2stateno` contact applies the borrowed/self-owned destination StateDef and Time=0 controllers during the collision frame before defender hit-shake advances its StateTime (Issue #134). Stored fields whose combat behavior is not connected are reported as `stored_not_applied`; failed evaluations retain their parameter names in diagnostics.

`PosFreeze` is a boolean controller, not a duration field. A nonzero value (default 1) suppresses only position integration for the Controller execution frame while StateTime, AnimTime, and Controller evaluation continue; stored velocity is not zeroed. Repeating the Controller with `trigger1 = Time <= 12` freezes each matching frame independently. This behavior is used by common airborne recovery State 5210 and T-H-M-A blocking State 902.

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

The matching ground/air/down/guard/airguard cornerpush value changes attacker X velocity only when the contacted target is at the existing fallback stage boundary; the value is converted by attacker Facing once. Omitted cornerpush parameters use the WinMUGEN default/inheritance chain, including non-air `ground = 1.3 * guard.velocity` and air-attribute `ground = 0`. `snap` places the target at attacker position plus Facing-relative X and absolute Y offsets. `p1sprpriority` and `p2sprpriority` update the two runtime sprite priority fields on hit or guard, using the WinMUGEN omitted defaults `1` and `0`; Canvas interleaves normal Player/Helper/Explod sprites from lower priority to higher priority. Camera-relative boundaries and Projectile sprite-priority integration remain Partial.

Successful contacts are recorded by ActiveHitDef generation, defender id, and HitDef `id`. Continued overlap with the same generation/defender pair cannot apply damage, HitEvent, or hit stun again; a new HitDef generation can hit again even when it uses the same `id`. Defender HitPause freezes that defender's CNS and motion but does not make it immune to a different active HitDef generation; bundled T-H-M-A State 3165 -> 3169 verifies the follow-up while the original defender pause remains. An accepted follow-up replaces that older defender pause with the new HitDef's `pausetime`; only a same-frame trade retains the longer of the two newly applied attacker/defender pauses. The defender remembers the last successful `id` and attacker: `chainid` requires that pair, `nochainid` rejects it, and a later third-party hit invalidates both constraints for the original attacker. `hitonce = 1` prevents a generation that already hit one target from affecting a different target; normal attacks default to 0 and throw attributes default to 1. Full team-mode target selection remains Partial.

For an airborne target, accepted contact also checks the attack StateDef `juggle` cost against the defender's remaining `[Data] airjuggle` pool (default 15 when omitted). The first accepted air contact in an attack chain consumes the cost for that target; later HitDef generations and continued attack States do not pay it again. Entering an attack StateDef with an explicit `juggle` value begins a new chain, while an omitted value in a directly continued attack State inherits the preceding payment as required for multi-State attacks. Ordinary grounded hits do not use this check. Air/down states retain the defender pool and grounded controllable recovery resets it. Helper/projectile/team chains remain Partial.

Attacker move-result state separately tracks contact, hit, guarded, and State-local hit count for MoveContact/MoveHit/MoveGuarded/HitCount. New HitDef generations reset result flags but retain count. On State entry, `hitdefpersist` independently preserves the ActiveHitDef and its consumed-target history, `movehitpersist` preserves result flags, and `hitcountpersist` preserves the count; omitted/zero flags discard their respective data. `MoveHitReset` clears only result flags, preserving duplicate-hit history and count.

Issue #66 verifies lifecycle ordering with the bundled T-H-M-A 3405/3415 data. Action 3405 reaches its AIR-derived end before the data-defined ChangeState enters 3415; the destination's HitDef activates from AnimElem and remains available while State 3415 is held until its `Time = 10` terminal route. A redirect lookup failure cannot substitute self and spuriously satisfy a controller. `raw.trigger`, `raw.controller_transition`, and `raw.hitdef_lifecycle` together identify the exact source controller and any later `reason=state_change` discard.

Successful non-KO contact also registers a Target entry with player id, HitDef id, and ActiveHitDef generation. Entries persist independently of State transitions and later KO, support multiple targets, and are removed when the target entity disappears, by `TargetDrop`, or on round restart. This permits lethal custom-State sequences such as T-H-M-A State 3670 to issue their delayed `TargetState 3685` release. Connected Target controllers select these entries by optional HitDef `id` and apply changes to the registered player.

HitDef `pausetime` is applied as separate attacker/defender counters. In accordance with Elecbyte's WinMUGEN HitDef specification, omission defaults both counters to `0,0`; an omitted `guard.pausetime` inherits the normal `pausetime` pair. Positive counters skip CNS controller execution and freeze physics/timers while input buffering continues; zero resumes without an extra frame. This hit pause is independent of the Partial SuperPause controller.

During the selected hit time, the runtime keeps `ctrl = false`, blocks control-enabling `CtrlSet`, blocks early recovery to State 0/52, and ignores State -1 ChangeState routes whose triggers actually read `Command`. Automatic character rules without a Command trigger remain available. During HitPause, ordinary Controllers still require `ignorehitpause = 1`; the narrow WinMUGEN compatibility exception is an automatic, non-Command State -2 `ChangeState`. Issue #131 requires this path for bundled itoko's `var(25) >= 100` guard-break route to enter State 2031 before the following paused reset clears the value. Internal common get-hit transitions such as State 5000 to 5001 remain available. Hit-stun elapsed time is stored independently from `stateTime` so internal get-hit State changes do not shorten the configured duration. When that time expires in a borrowed `TargetState`, fallback recovery retires the hit-stun timer without forcing State 0; the attacker's CustomState remains responsible for `ChangeState` and the eventual `SelfState` return.

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

## Issues #115-#131 compatibility notes

PalFX and BGPalFX retain independent red, green, and blue add/multiply/sinadd values through rendering. Player ImageData sprites use the channel transform directly; the Stage background pass is transformed before players and HUD are drawn. Indexed-palette rounding and external bitmap-player mutation remain Partial.

AfterImage retains exactly `length` captured samples, with `timegap` controlling capture cadence and the renderer selecting every `framegap` sample. Bundled itoko therefore retains 20 samples and displays five at steady state for its default `framegap=4`; RGB processing keeps its negative green/blue bright/add values red instead of collapsing them into a white Canvas brightness average.

Projectile positive removal time includes its creation tick. A Projectile with `projremovetime = 1` reaches one collision pass before retirement.

Guard contact accepts an entity already in common guard-ready States 120-132 in addition to live holdback intent. Standing/crouching/air GuardHit enter States 150/152/154 while selecting Actions 150/151/152 respectively, and negative guard velocity moves away from the attacker for both direct and Projectile contact.
