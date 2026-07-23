# Loader

Updated: 2026-07-06

This document describes how WebMUGEN loads and merges character files.

The loader must preserve WinMUGEN compatibility. Do not compensate for loader/runtime bugs by editing `public/chars/common1.cns`.

## Loaded asset types

A character load may involve:

- DEF: character metadata and file references;
- CNS: character state definitions;
- CMD: character commands and State -1 routes;
- AIR: animation actions and collision boxes;
- SFF/SpritePack: sprite data;
- SND v1: character WAV sample archive;
- WebMUGEN common files:
  - `public/chars/common1.cns`
  - `public/chars/common.cmd`

## CNS loading policy

```text
character CNS files
  +
public/chars/common1.cns
  ↓
merged CNS document
  ↓
CNS runtime
```

Rules:

- `common1.cns` is loaded as an external file.
- Character CNS/CMD StateDefs and the DEF-selected `stcommon` are merged first, followed by external `common1.cns`; WebMUGEN `common.cmd` routing is merged last. Positive State bodies therefore come from the character or `common1.cns`, never an identically numbered replacement in `common.cmd`.
- Do not embed another copy of `common1.cns` in TypeScript.
- Do not patch `common1.cns` for WebMUGEN convenience.
- Runtime incompatibilities should be fixed in parser/runtime/trigger/controller/physics layers.
- CNS punctuation and syntax whitespace follow the ASCII forms accepted by WinMUGEN. Shift-JIS full-width punctuation/spacing is retained rather than normalized into separators or discarded around tokens; for example, State 232's full-width comma does not create a `ground.velocity` Y component and its trailing full-width `animtype` space makes that enum value invalid.

Issue #58 Phase 5 builds a StateNo index whenever parsing or CNS/common/CMD merging produces a new
document. Duplicate StateNo entries retain array precedence: only the first entry is inserted, so
character/base States continue to win where the previous runtime `Array.find` selected them first.
The index is an execution lookup aid; it does not reorder or remove `states` used by static tooling.

Character `[Data]`, `[Size]`, `[Velocity]`, and `[Movement]` sections are retained as CNS metadata. `Const(...)` resolves those character sections before using the existing compatibility defaults. Directional jump and run-jump pairs therefore remain available to common State 40, and `movement.yaccel` reaches air physics without copying character values into TypeScript.

## CMD loading policy

```text
character CMD
  +
public/chars/common.cmd
  ↓
merged CMD document
  ↓
CommandResolver and State -1 runtime
```

Rules:

- Character-defined routes should take precedence when they define the same primary behavior.
- `common.cmd` fills missing baseline routes.
- Common routes should be visible as MUGEN data rather than hidden TypeScript when practical.

## SND loading policy

`[Files] sound` is resolved relative to the DEF path and loaded through the same binary fetcher used by HTTP and ZIP characters. The pure SND v1 parser reads the linked subfile archive and exposes all entries plus deterministic `group,index` lookup without creating an `AudioContext`.

The loader retains WAV payload bytes. Zero-byte, duplicate key, and non-RIFF/WAVE entries remain inspectable and carry parser diagnostics. Duplicate lookup uses the first archive entry while preserving later duplicates in the ordered sample list.

A missing SND or a fatal invalid header does not discard otherwise valid character assets. `CharacterAssets.sounds` is `null` and `loadDiagnostics` records the sound path/error. Missing required CNS/CMD/AIR remains fatal. This separation allows silent character loading while keeping the audio failure observable.

## SFF v1 palette policy

The SFF v1 converter resolves palette ownership before indexed PCX pixels become RGBA. A sprite with its own PCX palette keeps that palette and uses normal source-index lookup even when the character has a DEF-selected ACT. The external ACT path, including reversed ACT index lookup, applies only to shared character-palette sprites.

SFF subfile order is significant. A `samePalette` sprite inherits the previous effective palette in subfile sequence, including a preceding sprite-specific PCX palette. Linked sprites share the source pixel data but keep the linked node's palette context, so a linked node can inherit the previous effective palette instead of blindly sharing the source node's palette identity.

The resulting `ImageDataSpritePack` stores palette metadata and a palette cache key for each sprite. Normal player rendering, AIR Preview, and Explod rendering all consume the same baked RGBA data. Canvas bitmap caching is scoped by loaded asset identity, sprite group/index, baked palette key, and the Explod `ownpal` isolation flag. Identical group/index values from different owners or palette chains therefore cannot reuse one stale canvas. SFF v2 is rejected explicitly by the v1 parser; native SFF v2 decoding and dynamic palette effects remain unsupported rather than being interpreted as v1 data.

## Why `common.cmd` exists

`common.cmd` is WebMUGEN's common control layer.

It exists because some baseline behavior must be visible, debuggable, and changeable without hard-coding WinMUGEN control logic in TypeScript.

Examples:

- stand to crouch route;
- crouch hold and release route;
- jump start route;
- walk forward/back route;
- temporary movement glue such as VelSet or ChangeAnim while full common-state semantics are incomplete.

When State -1 is merged, a common baseline route and its State-number-gated movement glue stay
together ahead of character command routes. This matters when an attack is entered from common
walk State 20/21: the common `VelSet`/`ChangeAnim` may finish first, but cannot run afterward and
replace the attack StateDef animation. Bundled T-H-M-A coverage verifies State 21 -> 205 leaves
Anim 205 active rather than restoring Anim 21.

## Merge risks

The loader must avoid these mistakes:

1. dropping character-defined State -1 routes;
2. duplicating common routes in a way that changes command priority;
3. replacing `common1.cns` with a stale embedded copy;
4. merging CMD/CNS data in an order that makes common routes override character routes incorrectly;
5. losing trigger names or controller parameters during parsing.

## Debugging loader issues

If a route does not execute, inspect:

1. Static Debug tab StateDef list;
2. Static Debug tab Command → State expected routes;
3. State -1 controller count;
4. first several State -1 controllers;
5. command names resolved at runtime;
6. trigger group evaluation for the target route.

If Static Debug does not show the expected route, suspect loader/parser/merge.

If Static Debug shows the route but runtime skips it, suspect trigger evaluation or controller execution.

## Required tests

Loader tests should verify:

- character CMD and common CMD are both loaded;
- character routes are preserved;
- common routes fill missing baseline behavior;
- `common1.cns` states are available without modifying the file;
- a DEF-selected `stcommon` State wins over `common1.cns`, and `common1.cns` wins over an identically numbered State in `common.cmd`;
- State -1 merge keeps trigger/controller data intact.
- common movement glue remains before character routes that can replace State 20/21;
- DEF-relative and ZIP-relative SND paths load through `arrayBuffer`;
- group/index lookup returns the original WAV bytes;
- missing/invalid SND produces a load diagnostic without losing the character;
- duplicate, missing lookup, zero-byte, and unknown payload cases remain deterministic.

## Documentation update rule

When loader behavior changes, update:

- this document;
- `development-policy.md` if the architectural rule changes;
- compatibility matrix only when an actual compatibility item changes.
