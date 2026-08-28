# Implementation Inventory

Updated: 2026-08-23

This document is a high-level inventory of WebMUGEN implementation areas. It is not the source of truth for exact compatibility status; use the compatibility matrix for that.

- Content catalog Reader/Validator/Selection: `src/content/catalog/`, the `src/app/ContentCatalog.ts` facade, `public/content/catalog.json`, and `docs/webmugen/content-catalog.md`.
- Development Catalog generation: `src/content/catalog-generator/`; separate Character/Stage/LifeBar source handles and one output handle, direct same-origin paths, kind validation, built-in/external merging, pending-input tracking, and HTTP-first local Character/Stage asset fallback.
- URL content selection and Share URL generation: `src/app/UrlContentSelection.ts`, the Content settings UI, and `docs/webmugen/url-settings.md`.
- Proxy-release publication and Catalog administration adapter: `public/api/catalog.php` and `catalog-lib.php`; authenticated fixed-root Character/Stage ZIP classification, stable `proxy-release-*` IDs, deterministic DEF selection, revision-guarded GUI draft save, validated atomic Catalog replacement with `0644` permissions, and generated Character/Stage play URLs.
- Separated Stage/LifeBar presentation runtimes: `src/stage/{winmugen,webmugen}`, `src/lifebar/{winmugen,webmugen}`, and `docs/webmugen/native-presentation.md`.

## Parser layer

| Area | Status summary |
|---|---|
| DEF | Basic character metadata/file loading path exists. |
| CNS | StateDef, State Controllers, triggers, and many parameters are parsed. CNS punctuation and syntax whitespace remain ASCII-compatible; full-width punctuation/spacing is retained as data rather than promoted to syntax or silently trimmed from tokens. Other syntax remains incomplete. |
| CMD | Commands, hold prefixes, simple sequences, and buffer time exist. The production matcher prevents one unchanged diagonal hold from manufacturing alternating cardinal steps, with T-H-M-A-style normal/super conflict coverage. WinMUGEN timing still needs audit. |
| AIR | Actions, elements, timing, loop handling, Clsn blocks, and optional seventh-field blend values exist. Destination-alpha and subtractive Canvas rendering remain approximate. |
| SFF/Sprites | SpritePack renderer applies the Settings `p1`-`p12` choice to the first SFF v1 shared palette owner and its chain while preserving later effect-specific palettes, with first-ACT visual fallback for missing slots; full SFF compatibility may require further work. |
| SND | SND v1 header/subfile parsing, group/index lookup, WAV byte retention, HTTP/ZIP CharacterLoader integration, and non-fatal load diagnostics exist. Browser decoding/playback begins with Issues #27/#28. |

## Runtime layer

| Area | Status summary |
|---|---|
| State runtime | Negative states and current StateDef execution exist. |
| Trigger evaluator | Issue #82 inventories 158 versioned rows (122 expanded WinMUGEN rows plus 36 later/compatibility entries), separates parser retention from runtime values, records six-way classifications and bundled-character usage, and gates Matrix/evaluator registration. Subsystem-dependent triggers remain tracked as Parser only, Safe fallback, or Partial. |
| Controller executor | Basic state/motion/var/life/power controllers exist; many effects are Partial safe shims. |
| State entry | Centralized entry applies several StateDef header fields. |
| Physics | Basic position/velocity stepping exists; full WinMUGEN physics is Partial. |
| Animation | AIR-based animation selection and timing exist; exact edge cases need audit. |
| Hit/Collision | Partial live paths cover normal/guard/fall kill separation, explicit power/numhits, edge cornerpush, snap, sprite priority, effects, chains, targets, and common get-hit routing. Three-character P1/P2 real-data regression evidence is recorded in `hitdef-real-character-regression.md`; projectile/team/camera-relative behavior remains a major area. |
| Projectile/Helper/Explod | Projectile creation, velocity/acceleration, owner-AIR rendering, initial Clsn1 contact, damage/removal, owner-local ProjHit history, normal-hit Target acquisition, and TargetState/custom-state handoff are production-connected; full interaction/animation/pause semantics remain incomplete. Explod create/render/lifecycle, explicit-ID mutations, motion/render extensions, owner-hit removal, round cleanup, Pause/SuperPause gating, SFF v1 shared/sprite palette chain resolution, linked sprite palette ownership, ACT-only reversed index lookup, AIR seventh-field additive blend, AIR Preview parity, and owner/ownpal-isolated Canvas caching are production-connected. SFF v2, dynamic palette effects, destination/subtractive blend, shadows, and non-player owners remain incomplete; see `explod-integration-design.md`. Helper also remains incomplete. |
| Real Explod/Sound regression | KFM, T-H-M-A, and Yes030_e-rada production loading, P1/P2/Facing Explod/SND resolution, T-H-M-A ZIP, lifecycle, round reset, tab retention, and Audio cleanup are recorded in `explod-sound-real-character-regression.md`. |

## App/debug layer

| Area | Status summary |
|---|---|
| Browser input | Keyboard input, per-player Gamepad device assignment, reconnect recovery by id/mapping/same-id ordinal/index, configurable Button mappings, fixed left-stick Axis mappings, and a live input monitor exist. |
| Command debug | Active command names are visible. |
| CNS debug | Runtime traces expose state/animation/controller execution. |
| Physics debug | Post-physics state, velocity, facing, power, juggle pool, guard intent, and current/self State owner ids are visible. |
| Runtime history | Snapshot-based history exists for copyable debugging. |
| Hit effects | Contact envelopes feed same-frame shared Explod sparks, shared Browser Audio cues, and envshake offsets once per HitEvent. Character `S` scope is production-connected; bundled common fightfx/SND assets are absent and remain diagnosed Partial. |
| Browser audio | Shared lazy AudioContext adapter supports user-gesture unlock, decode cache, owner/channel gain and pan, a ramped persistent 0-100 master/mute UI (default 50%), stop/cleanup, and safe diagnostics. Common SND and advanced ownership remain incomplete. |
| Static debug | Character load, StateDef list, command routes, and coverage are visible. |
| Runtime settings | Publisher defaults, versioned per-origin browser settings, legacy-key migration, field validation, and full Settings reset are unified under `webmugen.settings.v1`; live match state is excluded. URL Character/Stage overrides remain session-only across unrelated setting changes. Persistent Character palette (`p1`-`p12`), Game time, fractional-cursor frame scheduling, hit diagnostics, root-player Power Infinite, Practice Mode zero-Life recovery/timer freeze, and four independent opt-in Debug/Logging sinks exist. Human/AI logs, collision boxes, lower-left history, and Practice Mode default OFF; a rolling 600-frame performance snapshot supports A-F comparisons. |
| Build mode | One explicit Development/Public baseline keeps Catalog management/generation, server-writer features, Character/Stage editing, and default export Development-only. Public starts locked and can elevate the current tab through the server-validated Development Mode Pass; reload fails closed to Public. Runtime diagnostics remain available in both modes. |

## Documentation layer

| Area | Document |
|---|---|
| Development rules | `development-policy.md` |
| Testing rules | `testing-policy.md` |
| Pipeline | `runtime-pipeline.md` |
| Loader | `loader.md` |
| Runtime | `runtime.md` |
| Trigger evaluator | `trigger.md` |
| Controller executor | `controller.md` |
| Physics | `physics.md` |
| Animation | `animation.md` |
| Debug Overlay | `debug-overlay.md` |
| Runtime History | `runtime-history.md` |
| Performance/debug settings | `performance-debug-settings.md` |
| Publisher/user settings | `settings.md` |
| Development/Public builds | `build-mode.md` |
| Power Infinite setting | `infinite-power-settings.md` |
| Matrix maintenance | `matrix-maintenance.md` |
| StateDef header notes | `state-def-header-notes.md` |
| Trigger notes | `trigger-compatibility-notes.md` |
| Controller notes | `state-controller-compatibility-notes.md` |
| CMD notes | `cmd-compatibility-notes.md` |

## Major unfinished systems

These should be split into smaller compatibility milestones:

- HitDef and full hit lifecycle;
- guard states and blocking;
- team/multi-player Target selection and Helper custom-state ownership;
- helper ownership and parent/root/target redirects;
- projectile contact and hit behavior;
- explod lifecycle and rendering;
- pause/superpause frame freezing and effect timing;
- full camera/screenbound behavior;
- exact WinMUGEN CMD timing.

## Good small next items

Prefer items that can be implemented and tested without a large subsystem rewrite:

- unsupported StateDef header persistence fields as stored Partial behavior;
- simple triggers close to existing context;
- simple controllers that mutate only player fields;
- CMD timing tests;
- debug overlay improvements that expose route failures.
