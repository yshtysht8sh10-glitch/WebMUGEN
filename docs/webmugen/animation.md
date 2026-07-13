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

## Runtime interaction

StateDef headers and controllers can select animation:

- StateDef `anim` applies when entering a state;
- `ChangeAnim` changes the current animation;
- `ChangeAnim2` is not full behavior while target/common animation ownership is incomplete.

## Trigger interaction

Animation-related triggers are matrix-tracked individually.

Current notes:

- `Anim`: numeric comparison is supported;
- `AnimTime`: uses MUGEN-style animation duration helper;
- `AnimExist`: Partial, uses runtime lookup when provided;
- `SelfAnimExist`: Partial, uses self animation lookup when provided;
- `AnimElemNo`: Partial, uses runtime animation element lookup when provided;
- `AnimElem` / `AnimElemTime`: simplified approximations need audit.

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
- looped and non-looped actions;
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

HitDef spark events carry common or attacker scope and the requested animation number into HitFeedback. Attacker-scoped `S` actions are validated against AIR; missing actions are diagnosed and not rendered. The Canvas renderer currently visualizes the requested id at the contact position rather than rendering full fightfx/character sprite animation frames, so spark rendering remains Partial.

Explod rendering resolves the current AIR element from the creating owner's asset scope, then uses the matching owner SFF sprite. World-space entries pass through the camera-X conversion while screen-space `front/back/left/right` entries do not. Explod Facing, vfacing, AIR flip, sprite priority, and `ontop` are applied in the effect layer; missing animation or sprite data is hidden with a diagnostic instead of a placeholder.

Do not promote animation triggers to Complete just because a simple KFM action works. Full AIR timing, loop behavior, and target/common animation ownership need broader verification.
