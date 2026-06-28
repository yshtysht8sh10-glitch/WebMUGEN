# WebMUGEN Common Loading Policy

Updated: 2026-06-28

This document records the current design policy for loading WinMUGEN-style common movement assets.

## Core Principle

`public/chars/common1.cns` is treated as an external compatibility asset, not as generated engine code.

Do not replace, rewrite, minimize, or regenerate `public/chars/common1.cns` from the loader or from embedded fallback text. Many characters are authored against a specific common state file, and changing that file changes the compatibility baseline. That makes character behavior difficult to reproduce and debug.

`public/chars/common.cmd`, on the other hand, is a WebMUGEN-owned compatibility/control surface. It may be edited freely to expose WinMUGEN-like common control flow in data form.

## Loader Responsibilities

The character loader may merge files, but it must preserve ownership boundaries:

| Asset | Owner | Loader behavior |
|---|---|---|
| Character `.cns` | Character | Load as the primary state source. |
| Character `.cmd` | Character | Load command definitions and character-specific `Statedef -1` routes. |
| `/chars/common1.cns` | Project/user compatibility asset | Load if present and merge only states/routes missing from the character. Never replace with embedded CNS. |
| `/chars/common.cmd` | WebMUGEN common control surface | Load if present and merge common command definitions/routes. This file may be changed to represent common WinMUGEN control logic. |
| Embedded common CMD fallback | Engine safety fallback | Use only when `/chars/common.cmd` is unavailable. Provides minimal routing only. |
| Embedded common CNS fallback | Not allowed | Do not use. State definitions must come from character CNS or external `common1.cns`. |

## Why `common1.cns` Must Not Be Embedded

Earlier iterations embedded simplified common state definitions for states such as `10`, `11`, `12`, `20`, `21`, and `40`. This made the app appear to regain crouch/walk/jump behavior, but it also changed the compatibility model:

- Characters designed for a specific `common1.cns` no longer ran against their expected common state bodies.
- Debugging became ambiguous because behavior could come from character CNS, external common CNS, or embedded replacement CNS.
- Reproducing WinMUGEN behavior became harder because the project silently substituted state definitions.

The corrected model is stricter:

1. State bodies come from character CNS or real `common1.cns`.
2. Command routing can be supplemented by common CMD routes.
3. Missing movement should be fixed by routing/evaluation/runtime behavior, not by replacing `common1.cns`.

## Common CMD Routing Policy

Common movement routes are command routes, not state-body replacements.

`public/chars/common.cmd` is intentionally allowed to evolve. Prefer exposing WinMUGEN-like control decisions in this file when that logic can be represented as CMD/CNS-style `Statedef -1` or `Statedef -2` routes.

This policy has two goals:

1. Keep common behavior visible and debuggable as MUGEN-like text.
2. Avoid hiding basic movement and common control flow inside TypeScript-only fallback code.

Examples of logic that should preferably live in `common.cmd` when possible:

| Logic | Preferred representation |
|---|---|
| Crouch entry | `holddown -> State 10` route in `Statedef -1` |
| Walk forward | `holdfwd -> State 20` route in `Statedef -1` |
| Walk back | `holdback -> State 21` route in `Statedef -1` |
| Jump start | `holdup -> State 40` route in `Statedef -1` |
| Landing transition | `physics = A` and ground-contact trigger in common routing when practical |
| Basic dash routes | `FF -> State 100`, `BB -> State 105` style routes when practical |
| Guard routes | `holdback`/guard-distance based routes when trigger support is ready |

TypeScript runtime support is still required for parsing, trigger evaluation, controller execution, physics, collision, and rendering. However, when a common control decision can be expressed in `common.cmd`, prefer doing so there first.

The loader may provide embedded baseline CMD routes when `/chars/common.cmd` is missing. These routes should be minimal and should point to conventional states, for example:

| Command | Intended route |
|---|---|
| `holddown` | `State 10` crouch start |
| `holdfwd` | `State 20` walk forward |
| `holdback` | `State 21` walk back |
| `holdup` | `State 40` jump start |

These routes only work if the target states exist in character CNS or external `common1.cns`.

## Command Route Priority

Common movement should not be discarded merely because a character uses the same direction as a modifier.

Example:

```cns
[State -1, Throw]
type = ChangeState
triggerall = command = "y"
trigger1 = command = "holdfwd"
value = 800
```

This does not mean `holdfwd` is the character's walk route. It means `holdfwd` is a modifier for the `y` command. The common `holdfwd -> State 20` route should remain available.

A character should override a common direction-only route only when the character defines that direction as the primary route command.

Example:

```cns
[State -1, Character Jump]
type = ChangeState
triggerall = command = "holdup"
trigger1 = ctrl
value = 41
```

In this case, the character's `holdup` route should override the common `holdup -> State 40` route.

## Current Implementation Notes

As of this policy:

- `CharacterLoader` no longer embeds replacement common CNS text.
- `CharacterLoader` still provides embedded baseline common CMD text when `/chars/common.cmd` is missing.
- `public/chars/common.cmd` is editable and should be the preferred place to expose common WinMUGEN-like routing logic.
- `mergeMissingCnsStates` keeps character-owned states first and appends missing common states only when absent.
- Common command controllers are inserted before character modifier routes so baseline movement remains reachable.
- Direction-only character routes can still override baseline direction routes.

## Debugging Checklist

When crouch or walk does not work, do not modify `common1.cns` first. Check these in order:

1. Confirm the active debug overlay shows the expected command, e.g. `holddown` or `holdfwd`.
2. Confirm `Statedef -1` contains the common route to `State 10`, `20`, or `21`.
3. Confirm the target state exists in character CNS or `/chars/common1.cns`.
4. Confirm trigger evaluation supports the expressions used by the route, especially `command`, `statetype`, and `ctrl`.
5. Confirm `stepCnsStateRuntime` executes `State -1` every frame before the current state.
6. Confirm state entry applies `type`, `physics`, `ctrl`, and `anim` from the target `Statedef`.

## Rules For Future Changes

1. Do not edit `public/chars/common1.cns` as part of engine fixes unless the explicit task is to update that compatibility asset.
2. Do not add embedded common CNS replacement text to `CharacterLoader`.
3. `public/chars/common.cmd` may be edited freely as the common control/routing surface.
4. Prefer representing common WinMUGEN control flow in `common.cmd` when possible, instead of hiding it in TypeScript fallback code.
5. If a movement bug appears after restoring `common1.cns`, fix loader merging, command routing, trigger evaluation, runtime state execution, or `common.cmd` routing.
6. Update this policy when the common loading model changes.
7. Keep the compatibility matrix aligned with this policy.
