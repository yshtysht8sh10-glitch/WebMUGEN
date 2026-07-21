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
- supporting `ChangeAnim` and eventually `ChangeAnim2` semantics;
- exposing enough debug information to distinguish runtime and rendering failures.

## AIR basics

An AIR action is selected by action number:

```text
Begin Action 20
20,0, 0,0, 4
20,1, 0,0, 4
20,2, 0,0, 4
```

Each element references a sprite group/image and has display time.

Current-element Clsn1 and Clsn2 boxes are converted through a shared world-coordinate API. The conversion applies the element X/Y offset, mirrors the combined local X coordinates for left-facing players, adds the player world origin, preserves multiple boxes, and returns no rectangles when the selected element has no applicable default or element Clsn block. Each result records attack/body kind, default/element source, animation number, element index, and box index for collision diagnostics and renderer debug labels.

The live app resolves player and Helper Clsn boxes from the pre-physics animation snapshot while
retaining post-physics world positions. CNS `AnimElem` triggers and collision therefore observe the
same AIR element even though physics increments `AnimTime` before hit resolution. A physics-driven
State or Anim change invalidates the snapshot. Bundled T-H-M-A State 215 covers the one-tick case:
its `AnimElem = 4` HitDef now overlaps Action 215 element 4 Clsn1 instead of activating after those
boxes have disappeared.

## Runtime interaction

StateDef headers and controllers can select animation:

- StateDef `anim` applies when entering a state;
- `ChangeAnim` changes the current animation;
- `ChangeAnim2` is not full behavior while target/common animation ownership is incomplete.

StateDef `anim` is not reapplied on later ticks in the same State. A `ChangeAnim` selected after entry therefore remains active until another controller or State transition changes it. Bundled T-H-M-A State 102 is covered for its State 101 entry path: Anim 107 remains selected after the following physics/runtime tick instead of reverting to the StateDef's Anim 102.

## Trigger interaction

Animation-related triggers are matrix-tracked individually.

Current notes:

- `Anim`: numeric comparison is supported;
- `AnimTime`: uses MUGEN-style animation duration helper;
- `AnimExist`: Partial, uses runtime lookup when provided;
- `SelfAnimExist`: Partial, uses self animation lookup when provided;
- `AnimElemNo`: Partial, uses runtime animation element lookup when provided;
- `AnimElem`: uses the AIR action's 1-based element number and is true only on the frame where that element starts. The start is detected again after both `LoopStart` and default whole-action loops. The legacy `AnimElem = N, op T` form compares the AIR-relative time for element N and rejects out-of-range element numbers.
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
- looped and non-looped actions, including the same `AnimElem` becoming true on later loops;
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

Explod rendering resolves the current AIR element from the creating owner's asset scope, then uses the matching owner SFF sprite. World-space entries pass through camera X/Y conversion once while screen-space `front/back/left/right` entries do not. Explod Facing, vfacing, AIR flip, sprite priority, and `ontop` are applied in the effect layer; AIR element offset and SFF axis offset are each composed once before scale. Missing animation or sprite data is hidden with a diagnostic instead of a placeholder.

Normal player rendering never substitutes Anim 0, Sprite 0, another player's SpritePack, or the debug
fallback after a character asset scope has been loaded. Missing AIR actions, unresolved/empty AIR
elements, missing SFF group/image pairs, negative `-1,-1` elements, and `AssertSpecial invisible` all
skip that player's draw for the frame. They remain distinct diagnostic results rather than being
collapsed into one fallback path. The debug fallback player is retained only when no character
SpritePack asset was loaded at all, so development/sample configurations remain distinguishable from
loaded character data with an asset-level omission.

Player renderer diagnostics use `raw.render` and include the entity, State, Anim, State owner,
animation owner, AIR element and sprite reference when available, `spriteExists`, visibility/draw
flags, and one of `animation_owner_missing`, `air_action_missing`, `air_element_missing`,
`intentional_invisible_element`, `sprite_missing`, or `entity_invisible`. A later valid Anim is resolved
normally; a prior missing result does not latch invisibility.

Explod lifecycle advances AIR time before each following-frame render. Finite non-loop actions reach AnimTime 0 and satisfy the default `removetime=-2`; `LoopStart` and negative-duration elements do not. A positive removetime counts the creation frame as its first displayed tick, `0` never reaches the renderer, and `-1` remains until an explicit later removal path.

Issue #34 applies Explod scale after Facing/vfacing and AIR horizontal flip, and maps additive modes to Canvas `lighter`. `addalpha` source alpha maps to `globalAlpha`. Issue #81 preserves the optional seventh AIR element field (`A`, `S`, `A1`, and `ASxxxDxxx`) and applies it to player, Projectile, and Explod sprite draws. An explicit Explod `trans` overrides the AIR element; omitted or `default` `trans` uses the AIR value. The Canvas approximation for bare AIR `A` combines `lighter` with 50% source alpha so dark SFF pixels do not make ghost/afterimage Explods appear opaque; diagnostics report `air_a_source_alpha_approximated`. `ASxxxDxxx` applies its source alpha through `globalAlpha`. Canvas cannot exactly reproduce WinMUGEN's bare-`A` coefficients, destination-alpha scaling, or subtractive blending, so those variants remain diagnosed approximations. Issues #45/#46 make normal player, AIR Preview, and Explod draws resolve the same owner-scoped AIR/SFF baked RGBA data. SFF v1 palette conversion preserves sprite-specific PCX palettes, subfile-order `samePalette` inheritance, linked-source pixels with linked-node palette context, and ACT-only reversed index lookup for shared character-palette sprites. The bitmap cache is isolated by asset identity, sprite id, palette key, and `ownpal`; runtime diagnostics include non-transparent/non-black RGBA counts and cache identity. Dynamic palette mutation after creation, destination alpha, subtractive blend, and a colored shadow pass remain diagnosed Partial behavior.

Issue #81 also retains the player's historical position, facing, Anim number, and Anim time for `AfterImage`. `timegap` controls capture cadence and `framegap` selects every Nth retained frame for display behind the owner. Controller `trans=add`/`add1` uses Canvas additive composition. Palette bright/add/multiply/contrast/postbright/color/invert values are parsed and represented by a diagnosed Canvas-filter approximation rather than exact indexed-palette mutation.

Do not promote animation triggers to Complete just because a simple KFM action works. Full AIR timing, loop behavior, and target/common animation ownership need broader verification.
