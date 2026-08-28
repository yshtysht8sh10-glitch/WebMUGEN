# Loader

Updated: 2026-08-25

This document describes how WebMUGEN loads and merges character files.

The application-level content list is defined by the validated catalog described in [content-catalog.md](content-catalog.md). Character and stage categories are determined from DEF structure, not merely from `.def` or `.zip` extensions. Public builds load only the publisher's same-origin catalog; development builds may edit and reload its source from Settings.

The loader must preserve WinMUGEN compatibility. Do not compensate for loader/runtime bugs by editing `public/chars/common1.cns`.

Character DEF metadata is also carried into runtime state. `[Info] name` and `author` supply the
matching string triggers. The Settings character palette selector supplies `PalNo` and selects the
matching DEF `palN` ACT for SFF v1 rendering. The selector accepts `p1` through `p12`; when the
requested ACT is absent, rendering falls back to the first resolved palette while `PalNo` retains the
requested number so character CNS palette branches remain observable. For SFF v1, the selected ACT
overrides the first shared palette owner and propagates through its `samePalette` chain; later
sprite-specific palettes, such as effect palettes, remain independent.

For ZIP Characters, the entry DEF is selected by Character structure rather than archive entry order. The loader inspects all DEF files and accepts definitions with `[Info]`, Character `[Files]`, `cmd`, `anim`, and either `cns` or `st`; stage, storyboard, and system DEFs are ignored. When archives contain a normal definition plus backup or no-AI variants, the candidate at the shallowest directory depth wins. Candidates at the same depth are ranked by the fewest non-letter/non-number characters in the filename, then the shortest filename, then lexical path order. This permits proxy-upload filenames, outer folders, and common variant subfolders while keeping selection deterministic. Zero valid Character definitions are rejected.

All ZIP references are resolved relative to the selected DEF directory. Backslashes, `.` segments, case differences, and safe `..` segments within the archive are normalized; traversal above the archive root and case-insensitive duplicate paths are rejected. A missing Character-owned referenced asset is fatal and cannot fall through to an HTTP path. Only WebMUGEN's explicit `/chars/common1.cns` and `/chars/common.cmd` engine assets use the HTTP fallback.

HTTP Character assets under `/chars/` are resolved from the deployed application directory rather
than the origin root. This keeps built-in Characters and the common CNS/CMD available when Public
WebMUGEN is hosted below a path such as `/DotoEita/50_WebMUGEN/`; external proxy-release storage
paths remain origin-absolute. ZIP entry names use the UTF-8 flag or Unicode Path extra field when
present. Legacy names without either marker accept valid UTF-8 first and otherwise decode as
Shift-JIS/CP932, so WinMUGEN-era Japanese filenames remain selectable and inspectable.

When a Catalog generated from a local Character folder retains a `/chars/<relative path>` entry,
the loader first keeps the normal HTTP behavior. If that load fails, including a development server
returning its HTML fallback with HTTP 200 for a missing ZIP, it resolves the same relative path
through the saved Character `FileSystemDirectoryHandle` and retries the ZIP/DEF load locally.
The HTTP path always wins when it exists, and WebMUGEN's `/chars/common1.cns` and
`/chars/common.cmd` remain application assets rather than local-folder overrides. Missing or expired
folder permission preserves the original HTTP load error and sample fallback behavior.

The WinMUGEN Stage ZIP loader applies the same server-first rule to `/stages/<relative path>`.
When HTTP loading or ZIP parsing fails, it reads the relative ZIP through the saved Stage
`FileSystemDirectoryHandle` and retries the normal Stage DEF/SFF parser. This local transport does
not change Stage semantics: candidate DEF selection, referenced SFF validation, layer parsing, and
runtime construction remain identical to an HTTP-loaded archive. Missing permission or a missing
local ZIP preserves the original Stage load error and the application's visible Stage fallback.

Text contents are decoded independently for every DEF, CNS, CMD, AIR, ZSS, JSON, and inspectable text entry. UTF-8, UTF-16LE, and UTF-16BE BOMs take priority; without a BOM, a strict UTF-8 decode is attempted and valid UTF-8 is accepted, otherwise the bytes are decoded as Shift-JIS/CP932. The same detector is used by ZIP Characters, unpacked HTTP Characters, ZIP Stages, Catalog classification, and the development file inventory. This permits UTF-8 and CP932 files to coexist in one Character without passing different strings to the file viewer and runtime parser.

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

## Character-file inventory and local editing

After the runtime-required assets have loaded, the app builds a separate file-browser inventory. HTTP characters enumerate every file beneath the selected DEF directory through the local Vite middleware. ZIP characters enumerate every archive entry. Known MUGEN text files and arbitrary text files use the same per-file UTF/CP932 detector as runtime loading; SFF and ACT entries retain their binary bytes for sprite/palette inspection; other binary entries remain identifiable without being decoded as text.

The inventory does not alter parser input, runtime merge order, or compatibility behavior. Runtime-referenced files outside the character DEF directory are merged into the inventory and marked external so common CNS/CMD sources remain inspectable without appearing to belong to the character package.

Local editing uses the development-only `/__webmugen/character-files` endpoint. It accepts only files rooted under `public/chars`; direct text files are written as Shift-JIS and ZIP entries are saved by rebuilding the containing archive. Archive entry names containing parent traversal are rejected. Production static hosting intentionally has no write path.

Development/Public feature flags also gate the browser entry points. Public Mode does not render Character Files or character path/select/Load controls, its handlers reject direct calls, and startup ignores a saved Development Mode character path in favor of the publisher's normalized default selection.

## CNS loading policy

The CNS parser accepts both canonical controller headers such as `[State 200, Hit]` and real WinMUGEN label-only forms such as `[State Turn]` or `[state that transparensizes impact on team play]` when they occur inside the current StateDef. These forms start a new Controller rather than an unrelated metadata section; bundled T-H-M-A State 3935 depends on this to execute its Time 0 `Turn` before applying facing-relative launch velocity.

Within a State Controller, duplicate non-trigger parameters use WinMUGEN's first-value-wins rule; later occurrences are ignored. Trigger lines remain repeatable. Bundled T-H-M-A State 3630 depends on the first `postype = back` surviving a later stale `postype = p1` line so its 320x240 Action 3603 background remains screen-aligned beneath the subtractive Action 3635 lightning.

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

Character `[Data]`, `[Size]`, `[Velocity]`, and `[Movement]` sections are retained as CNS metadata. Numeric two-component metadata such as `down.bounce.offset = X,Y` keeps its raw pair and also receives a normalized `{x,y}` vector view; this is syntax normalization and does not select version-specific semantics. `Const(...)` resolves character data before the current compatibility defaults. Directional jump and run-jump pairs therefore remain available to common State 40, and `movement.yaccel` reaches air physics without copying character values into TypeScript. Compatibility-profile ownership of Const validity and defaults is specified in `docs/architecture/compatibility.md` and is not yet implemented.

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
- `/chars/common.cmd` is the only WebMUGEN common CMD path. There is no loaded `common1.cmd`; `common1.cns` is the separate WinMUGEN-compatible common State body asset.
- Common routes should be visible as MUGEN data rather than hidden TypeScript when practical.

## SND loading policy

`[Files] sound` is resolved relative to the DEF path and loaded through the same binary fetcher used by HTTP and ZIP characters. The pure SND v1 parser reads the linked subfile archive and exposes all entries plus deterministic `group,index` lookup without creating an `AudioContext`.

The loader retains WAV payload bytes. Zero-byte, duplicate key, and non-RIFF/WAVE entries remain inspectable and carry parser diagnostics. Duplicate lookup uses the first archive entry while preserving later duplicates in the ordered sample list.

A missing SND or a fatal invalid header does not discard otherwise valid character assets. `CharacterAssets.sounds` is `null` and `loadDiagnostics` records the sound path/error. Missing required CNS/CMD/AIR remains fatal. This separation allows silent character loading while keeping the audio failure observable.

## SFF v1 palette policy

The SFF v1 converter resolves palette ownership before indexed PCX pixels become RGBA. A sprite with its own PCX palette keeps that palette and uses normal source-index lookup even when the character has a DEF-selected ACT. The external ACT path, including reversed ACT index lookup, applies only to shared character-palette sprites.

SFF subfile order is significant. A `samePalette` sprite inherits the previous effective palette in subfile sequence, including a preceding sprite-specific PCX palette. Linked sprites share the source pixel data but keep the linked node's palette context, so a linked node can inherit the previous effective palette instead of blindly sharing the source node's palette identity.

An embedded PCX VGA palette is accepted only when the RLE image data before its terminal marker decodes the complete declared image. This avoids treating an incidental `0x0c` byte at the marker-shaped offset of a shared-palette SFF subfile as a palette, which previously truncated bundled T-H-M-A sprite `5203,2` and hid the second element of bounce Action 5170.

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

1. the character DEF/CMD/CNS and applied common files in `Character Files`;
2. the relevant StateDef and State -1 source sections;
3. State -1 controller count in copied diagnostics or runtime traces;
4. first several State -1 controllers;
5. command names resolved at runtime;
6. trigger group evaluation for the target route.

If `Character Files` does not contain the expected referenced source, suspect inventory or path resolution first. If the source exists but copied/runtime diagnostics do not contain the expected route, suspect loader/parser/merge.

If diagnostics contain the route but runtime skips it, suspect trigger evaluation or controller execution.

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

## MUGEN stage ZIPs

The application can select an external ZIP URL independently from the HUD design. `AppStageLoader` normalizes archive paths, applies the shared per-file UTF/CP932 detector to DEF text, selects the first DEF deterministically, resolves its sibling `[BGDef] spr` entry, and converts the referenced SFF v1 into the existing RGBA sprite pack. The supported static slice covers normal BG layers (`spriteno`, `start`, `delta`, and `layerno`), `StageInfo hires/zoffset/autoturn`, the Camera start/bounds/tension/verticalfollow/floortension fields, PlayerInfo starts/facings/bounds, and Bound screenleft/screenright. Omitted `autoturn` defaults to enabled; zero disables the common Facing update. For WinMUGEN D4 stages, `HiRes = 1` keeps BG `start` and SFF axes in the Hi-Res source coordinate space while low-resolution camera movement is multiplied by the authored BG `delta`. Stage `zoffset` maps the gameplay floor to the camera but is not added to BG `start`, which is relative to the screen's top center. The bundled beach sky therefore moves from Y -220 at camera Y 0 to Y 0 at `boundhigh = -110` with `delta.y = 2`, retaining full vertical coverage. Parsed horizontal camera bounds retain WinMUGEN's 320-coordinate viewport meaning: runtime insets them by 40 per side only for the extended 400-wide profile, while the classic profile consumes the DEF values unchanged. Missing DEF/SFF data or an archive without supported layers fails visibly and falls back to the selected built-in stage rather than silently producing a blank arena.

This is not yet a complete stage loader. BG animations/controllers, tiling, window clipping, foreground `layerno = 1`, exact PlayerInfo spawn/bound integration, shadow/reflection, and stage audio still require separate compatibility work.
