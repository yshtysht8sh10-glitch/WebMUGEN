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
- Do not embed another copy of `common1.cns` in TypeScript.
- Do not patch `common1.cns` for WebMUGEN convenience.
- Runtime incompatibilities should be fixed in parser/runtime/trigger/controller/physics layers.

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

## Why `common.cmd` exists

`common.cmd` is WebMUGEN's common control layer.

It exists because some baseline behavior must be visible, debuggable, and changeable without hard-coding WinMUGEN control logic in TypeScript.

Examples:

- stand to crouch route;
- crouch hold and release route;
- jump start route;
- walk forward/back route;
- temporary movement glue such as VelSet or ChangeAnim while full common-state semantics are incomplete.

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
- State -1 merge keeps trigger/controller data intact.
- DEF-relative and ZIP-relative SND paths load through `arrayBuffer`;
- group/index lookup returns the original WAV bytes;
- missing/invalid SND produces a load diagnostic without losing the character;
- duplicate, missing lookup, zero-byte, and unknown payload cases remain deterministic.

## Documentation update rule

When loader behavior changes, update:

- this document;
- `development-policy.md` if the architectural rule changes;
- compatibility matrix only when an actual compatibility item changes.
