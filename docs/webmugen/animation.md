# Animation Runtime

Updated: 2026-07-06

This document describes animation behavior relevant to WebMUGEN compatibility.

## Responsibility

The animation layer connects CNS state logic to AIR actions and rendered sprites.

It is responsible for:

- loading AIR actions;
- advancing animation time;
- resolving animation elements;
- supporting `Anim`, `AnimTime`, `AnimElem`, `AnimElemTime`, `AnimElemNo`, `AnimExist`, and `SelfAnimExist` triggers;
- supporting `ChangeAnim` and `ChangeAnim2` ownership semantics;
- exposing enough debug information to distinguish runtime and rendering failures.

## AIR basics

An AIR action is selected by action number:

```text
Begin Action 20
20,0, 0,0, 4
20,1, 0,0, 4
20,2, 0,0, 4
```

Each element references a sprite group/image and has display time. AIR `H` and `V` flags mirror the
sprite around its axis on the corresponding Canvas axis. The vertical flag composes with Explod
`vfacing` and AngleDraw instead of being discarded. Bundled itoko Action 1370 uses `V` on every
frame so its Helper 1310/1311 control threads extend upward from itoko toward the overhead Helper,
not downward through the floor.

Current-element Clsn1 and Clsn2 boxes are converted through a shared world-coordinate API. The conversion combines the element X/Y offset with the AIR box, applies the character `[Size] xscale/yscale` once, mirrors the scaled local X coordinates for left-facing players, adds the player world origin, preserves multiple boxes, and returns no rectangles when the selected element has no applicable default or element Clsn block. The same world rectangles drive live hit detection and renderer debug labels, so a high-resolution character using `0.5,0.5` does not retain double-sized Clsn boxes around its correctly scaled sprite. Each result records attack/body kind, default/element source, animation number, element index, and box index for collision diagnostics.

The live app resolves player and Helper rendering, Clsn boxes, and AfterImage capture from the
pre-physics animation snapshot while retaining post-physics world positions. CNS `AnimElem`
triggers, presentation, and collision therefore observe the same AIR element even though physics
increments `AnimTime` before those later phases. A State or Anim identity change invalidates the
snapshot. Bundled T-H-M-A State 215 covers the one-tick collision case: its `AnimElem = 4` HitDef
overlaps Action 215 element 4 Clsn1 instead of activating after those boxes have disappeared.
Bundled itoko State 730 covers presentation timing: `Animelem = 11` applies `PosAdd` and `Turn`
before Action 730 element 11 (`5030,506`) is first drawn, so the get-up sprite never flashes at the
old lying position.

New Helpers still defer their first CNS State/physics pass until the following frame. Their creation
frame visibility depends on whether the initial State already has a stable presentation. Helpers with
`ChangeAnim`, `AngleDraw`, position, palette, Facing, or similar visual controllers wait for that first
pass, while a StateDef-only initial sprite may draw immediately. This keeps itoko's strong rubber belt
from flashing its uninitialized green sprite and also keeps rocket-hand Helper 1421 visible on the tick
it replaces the attached hand.

## Runtime interaction

StateDef headers and controllers can select animation:

- StateDef `anim` applies when entering a state;
- `ChangeAnim` changes the current animation;
- `ChangeAnim2` selects the current custom-State owner's AIR action while each selected AIR element resolves its group/image from the animated player's own SFF. AIR ownership and sprite-image ownership are deliberately separate. This is required by T-H-M-A Darkness Finger Shinuchi State 3425: its borrowed Action 3425 references standard `5002,*` images that must remain the struck character's sprites. Helper-owner and missing cross-character asset variants remain incomplete.

StateDef `anim` is not reapplied on later ticks in the same State. A `ChangeAnim` selected after entry therefore remains active until another controller or State transition changes it. On a new State entry, however, an explicit `anim` restarts at time zero even when its number equals the current animation; an omitted `anim` inherits both the current number and time. This restart also applies when HitDef `p1stateno` or `p2stateno` changes State outside the ordinary ChangeState path. Bundled itoko State 700 verifies that `p1stateno = 710` starts Anim 710 at time zero instead of inheriting Anim 700's time 18, so the throw animation does not finish before P2's custom State 711 fall. Bundled T-H-M-A State 102 is covered for its State 101 entry path: Anim 107 remains selected after the following physics/runtime tick instead of reverting to the StateDef's Anim 102. Its Projectile wall route also verifies that State 280 -> 281 restarts explicit Anim 5012, keeping State 281 observable to the attacker's State -1 wall Explod and sound Helper after a long flight.

State entries created outside the ordinary ChangeState controller path still apply expression-valued
StateDef animation headers on the following CNS entry pass. In particular, T-H-M-A HitOverride
State 902 evaluates `902+(Random%3)*3` to Anim 902, 905, or 908 in the HitOverride contact frame. Its Time=0 Controller pass also runs before the contact frame completes, so PosFreeze advances animation/State clocks without moving the character and the pre-block Anim is never retained for an extra frame.

## Trigger interaction

Animation-related triggers are matrix-tracked individually.

Current notes:

- `Anim`: numeric comparison is supported;
- `AnimTime`: uses MUGEN-style looptime. Any AIR action containing a `-1` duration element has infinite looptime, including actions with finite elements before the terminal hold, so `AnimTime = 0` never fires for that action. Issue #120 verifies this with itoko Action 1460 while the high doll waits in ground-catch State 1463;
- `AnimExist`: Partial, uses runtime lookup when provided;
- `SelfAnimExist`: Partial, uses self animation lookup when provided;
- `AnimElemNo`: Partial, uses runtime animation element lookup when provided;
- `AnimElem`: uses the AIR action's 1-based element number and is true on the frame where that element starts, including after `helper`, `enemy`, and other player redirects. A finite action with no `LoopStart` repeats the whole action and re-enters bare `AnimElem = N` on each pass. Explicit `LoopStart` and a negative-duration element retain the original non-resetting trigger timeline; an infinite terminal element therefore fires only when first reached. `AnimElemTime` and the legacy `AnimElem = N, op T` form continue to compare the original AIR-relative time and reject out-of-range element numbers. Bundled itoko State 1464 verifies that a three-tick redirected element launches P2 once; bundled T-H-M-A Helper State 3031 repeatedly creates Action 3030, while State 3940's infinite element 11 enters TargetState 3935 only once.
- `AnimElemTime`: uses the same AIR-relative element timeline instead of subtracting the element number from global `animTime`.

## Common failure patterns

| Symptom | Likely issue |
|---|---|
| `stateNo` changed but `animNo` stayed old | StateDef `anim` missing or state entry did not apply. |
| `animNo` changed but sprite did not change | AIR/SpritePack/rendering lookup. |
| `AnimTime` never reaches expected value | animation duration / loop handling. |
| `AnimExist` false for existing action | lookup context not supplied or AIR not loaded. |
| walk state entered but idle animation remains | movement route needs ChangeAnim or state/common behavior. |

## Test guidance

Animation tests should include:

- action exists / does not exist;
- current animation number;
- animation element at a given time;
- looped and non-looped actions, including finite loops not retriggering the same `AnimElem` on later passes;
- state entry setting animation;
- `ChangeAnim` resetting `animTime` when animation changes.

## Debug guidance

When debugging animation, expose:

- `stateNo`;
- `animNo`;
- `animTime`;
- MUGEN-style `AnimTime`;
- current element index when available;
- whether the action exists in AIR.

## Compatibility caution

HitDef spark events carry common or attacker scope, the requested animation number, and an explicit absolute stage-space position into the shared Explod effect path. Issue #49 resolves that position from P2's P1-facing `Size` edge for X and P1's axis for Y, then avoids owner/root rebinding. Attacker-scoped `S` actions resolve the attacker's AIR/SFF, advance with normal AIR lifecycle, and render in the contact frame. Common/`F` actions use fightfx assets when supplied; the bundled app has no fightfx AIR/SFF and diagnoses that scope instead of drawing a placeholder. Missing actions are safe no-ops. The former fixed-circle HitFeedback renderer is suppressed for runtime-integrated sparks while envshake remains there.

Explod rendering resolves the current AIR element from the creating owner's asset scope, then uses the matching owner SFF sprite. World-space entries pass through camera X/Y conversion once while screen-space `front/back/left/right` entries do not. WinMUGEN-compatible 320/400x240 viewports receive no built-in-stage visual-floor displacement. The WebMUGEN-only 960x540 presentation moves the complete stage-space presentation together—root players, Helpers, Projectiles, P1/P2/stage Explods, afterimages, and fallback hit sparks—by one fixed offset derived from the authored ground axis, while screen-space Explods remain anchored to the viewport. Player Y, StateType, and velocity never participate in that offset, so standing-typed special states such as T-H-M-A State 3730 retain their authored vertical motion. External stages retain their DEF-defined floor. Explod Facing, vfacing, AIR flip, sprite priority, and `ontop` are applied in the effect layer. Normal Player/Helper/Explod sprites share one lower-to-higher `sprpriority` queue; `ontop = 1` bypasses that comparison and draws in the later top pass. At equal priority, newer Helper/Explod objects are queued behind the older root-player sprite. This keeps T-H-M-A State 3640's priority-5 full-screen Action 3603 background behind the priority-5 Action 3640 player. Bundled T-H-M-A State 3930 therefore draws its Anim 3901 portrait at `-1`, both players next, and the Anim 3914/3926/3927 accents at `3`/`4`. When multiple Explods share a sprite priority, newer entries are drawn first so the earlier-created entry remains in front as in WinMUGEN. This preserves the bundled T-H-M-A State 5400 gauge, where the earlier Action 11100 blue fill must cover the later Action 11200 red fill below the threshold boundary. AIR element offset and SFF axis offset are each composed once before scale. Missing animation or sprite data is hidden with a diagnostic instead of a placeholder.

Normal player rendering never substitutes Anim 0, Sprite 0, another player's SpritePack, or the debug
fallback after a character asset scope has been loaded. Missing AIR actions, unresolved/empty AIR
elements, missing SFF group/image pairs, negative `-1,-1` elements, and `AssertSpecial invisible` all
skip that player's draw for the frame. They remain distinct diagnostic results rather than being
collapsed into one fallback path. The debug fallback player is retained only when no character
SpritePack asset was loaded at all, so development/sample configurations remain distinguishable from
loaded character data with an asset-level omission.

Player renderer diagnostics use `raw.render` and include the entity, State, Anim, State owner,
AIR animation owner, self sprite owner, AIR element and sprite reference when available, `spriteExists`, visibility/draw
flags, and one of `animation_owner_missing`, `sprite_owner_missing`, `air_action_missing`, `air_element_missing`,
`intentional_invisible_element`, `sprite_missing`, or `entity_invisible`. A later valid Anim is resolved
normally; a prior missing result does not latch invisibility.

In the default WinMUGEN Hi-Res profile, the renderer maps the 320x240 compatibility coordinate view to a physical 640x480 Canvas with a 2x outer transform. Root and Helper sprite rendering then applies the entity's `[Size] xscale/yscale` inside that transform. A normal `1,1` character therefore renders at 2x physical size, while high-resolution character data using `0.5,0.5` renders at net 1x. Canvas image smoothing is disabled so integer-expanded low-resolution sprites retain hard pixel edges while native high-resolution sprite data reaches the 640x480 target. The 960x540 wide profile keeps a 1x outer transform.

The browser layout does not upscale the game Canvas beyond the selected screen profile's intrinsic
pixel width. The viewport centers that intrinsic width and uses `max-width: 100%` to shrink it on a
narrower browser while preserving its aspect ratio. This CSS presentation scaling does not change
the Canvas backing resolution, logical MUGEN coordinates, collision geometry, or runtime state.

Explod lifecycle advances AIR time before each following-frame render. Finite non-loop actions reach AnimTime 0 and satisfy the default `removetime=-2`; `LoopStart` and negative-duration elements do not. A positive removetime counts the creation frame as its first displayed tick, `0` never reaches the renderer, and `-1` remains until an explicit later removal path.

Issue #34 applies Explod scale after Facing/vfacing and AIR horizontal flip, and maps additive modes to Canvas `lighter`. `addalpha` source alpha maps to `globalAlpha`. Issue #81 preserves the optional seventh AIR element field (`A`, `S`, `A1`, and `ASxxxDxxx`) and applies it to player, Helper, Projectile, and Explod sprite draws. An explicit Explod `trans` overrides the AIR element; omitted or `default` `trans` uses the AIR value. The Canvas approximation for bare AIR `A` combines `lighter` with 50% source alpha so dark SFF pixels do not make ghost/afterimage Explods appear opaque; diagnostics report `air_a_source_alpha_approximated`. `ASxxxDxxx` applies its source alpha through `globalAlpha`. AIR `S`/`sub` uses an isolated destination-color pass implementing `max(0, destination RGB - source RGB * source alpha)`; bundled T-H-M-A State 3540, Helper State 3322, and Action 10030 provide real-character evidence. The pass treats transparent Canvas pixels as WinMUGEN's opaque-black framebuffer, which keeps subtractive sprites invisible outside opaque content during `AssertSpecial noBG`. Canvas cannot exactly reproduce WinMUGEN's bare-`A` coefficients or destination-alpha scaling, so those variants remain diagnosed approximations. Issues #45/#46 make normal player, AIR Preview, and Explod draws resolve the same owner-scoped AIR/SFF baked RGBA data. SFF v1 palette conversion preserves sprite-specific PCX palettes, subfile-order `samePalette` inheritance outside the character run, linked-source pixels with linked-node palette context, and ACT-only reversed index lookup for the contiguous shared run beginning at group 0. This prevents individual 9000-group portraits from becoming Kaoru_Hanayama's in-game character palette while retaining later individual effect palettes. The bitmap cache is isolated by asset identity, sprite id, palette key, and `ownpal`; runtime diagnostics include non-transparent/non-black RGBA counts and cache identity. Dynamic palette mutation after creation, destination alpha, a colored shadow pass, and unusually split character-palette runs remain diagnosed Partial behavior.

Issue #81 also retains the player's historical position, facing, Anim number, Anim time, and the tick-scoped `AngleDraw` angle/X/Y scale for `AfterImage`. `length` is the saved-history capacity, `timegap` controls capture cadence, and `framegap` selects every Nth retained frame for display behind the owner; Canvas reapplies each frame's transform around its AIR-offset-adjusted sprite axis using WinMUGEN's facing-relative, counterclockwise-positive angle convention. AIR offsets are affected by AngleDraw scale but not rotation, matching the AIR format and bundled itoko Action 106's back-dash somersault. Controller `trans=add`/`add1` uses Canvas additive composition. ImageData sprites apply `palcolor`, `palinvertall`, `palbright`, `palcontrast`, and `palpostbright` per RGB channel, then repeat `paladd` followed by `palmul` for successively older displayed images. External bitmap sprites retain the diagnosed Canvas-filter fallback.

Do not promote animation triggers to Complete just because a simple KFM action works. Full AIR timing, loop behavior, and target/common animation ownership need broader verification.

Issues #115/#121/#123 replace RGB averaging for PalFX/BGPalFX with channel-preserving pixel transforms. Issue #116 applies the same channel-preserving principle to AfterImage while retaining the documented `length`-sample history and `framegap` display selection. For bundled itoko values (`length=20`, `timegap=2`, default `framegap=4`), the steady trail contains five selected red images; additive overlap produces the bright red core seen in WinMUGEN. Exact indexed-palette rounding and external bitmap palette mutation remain Partial.
