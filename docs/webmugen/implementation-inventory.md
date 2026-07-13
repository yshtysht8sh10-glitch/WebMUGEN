# Implementation Inventory

Updated: 2026-07-13

This document is a high-level inventory of WebMUGEN implementation areas. It is not the source of truth for exact compatibility status; use the compatibility matrix for that.

## Parser layer

| Area | Status summary |
|---|---|
| DEF | Basic character metadata/file loading path exists. |
| CNS | StateDef, State Controllers, triggers, and many parameters are parsed. Some syntax remains incomplete. |
| CMD | Commands, hold prefixes, simple sequences, and buffer time exist. WinMUGEN timing still needs audit. |
| AIR | Actions, elements, timing, loop handling, and Clsn blocks exist. Edge cases remain. |
| SFF/Sprites | SpritePack renderer prototype exists; full SFF compatibility may require further work. |
| SND | SND v1 header/subfile parsing, group/index lookup, WAV byte retention, HTTP/ZIP CharacterLoader integration, and non-fatal load diagnostics exist. Browser decoding/playback begins with Issues #27/#28. |

## Runtime layer

| Area | Status summary |
|---|---|
| State runtime | Negative states and current StateDef execution exist. |
| Trigger evaluator | Many simple triggers and expression features exist; subsystem-dependent triggers remain Partial/Unsupported. |
| Controller executor | Basic state/motion/var/life/power controllers exist; many effects are Partial safe shims. |
| State entry | Centralized entry applies several StateDef header fields. |
| Physics | Basic position/velocity stepping exists; full WinMUGEN physics is Partial. |
| Animation | AIR-based animation selection and timing exist; exact edge cases need audit. |
| Hit/Collision | Partial live paths cover normal/guard/fall kill separation, explicit power/numhits, edge cornerpush, snap, sprite priority, effects, chains, targets, and common get-hit routing. Three-character P1/P2 real-data regression evidence is recorded in `hitdef-real-character-regression.md`; projectile/team/camera-relative behavior remains a major area. |
| Projectile/Helper/Explod | Explod create/render/lifecycle, explicit-ID mutations, motion/render extensions, owner-hit removal, round cleanup, Pause/SuperPause gating, SFF v1 shared/sprite palette selection, and owner/ownpal-isolated Canvas caching are production-connected. SFF v2, dynamic palette effects, destination/subtractive blend, shadows, and non-player owners remain incomplete; see `explod-integration-design.md`. Helper/Projectile also remain incomplete. |
| Real Explod/Sound regression | KFM, T-H-M-A, and Yes030_e-rada production loading, P1/P2/Facing Explod/SND resolution, T-H-M-A ZIP, lifecycle, round reset, tab retention, and Audio cleanup are recorded in `explod-sound-real-character-regression.md`. |

## App/debug layer

| Area | Status summary |
|---|---|
| Browser input | Keyboard input and player mapping exist. |
| Command debug | Active command names are visible. |
| CNS debug | Runtime traces expose state/animation/controller execution. |
| Physics debug | Post-physics state, velocity, facing, power, juggle pool, guard intent, and current/self State owner ids are visible. |
| Runtime history | Snapshot-based history exists for copyable debugging. |
| Hit effects | Contact envelopes feed same-frame shared Explod sparks, shared Browser Audio cues, and envshake offsets once per HitEvent. Character `S` scope is production-connected; bundled common fightfx/SND assets are absent and remain diagnosed Partial. |
| Browser audio | Shared lazy AudioContext adapter supports user-gesture unlock, decode cache, owner/channel gain and pan, a ramped persistent 0-100 master/mute UI (default 50%), stop/cleanup, and safe diagnostics. Common SND and advanced ownership remain incomplete. |
| Static debug | Character load, StateDef list, command routes, and coverage are visible. |

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
| Matrix maintenance | `matrix-maintenance.md` |
| StateDef header notes | `state-def-header-notes.md` |
| Trigger notes | `trigger-compatibility-notes.md` |
| Controller notes | `state-controller-compatibility-notes.md` |
| CMD notes | `cmd-compatibility-notes.md` |

## Major unfinished systems

These should be split into smaller compatibility milestones:

- HitDef and full hit lifecycle;
- guard states and blocking;
- target lists and custom states;
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
