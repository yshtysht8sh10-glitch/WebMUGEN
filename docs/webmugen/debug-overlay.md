# Debug Overlay

Updated: 2026-08-16

The Debug Overlay is part of the compatibility workflow. It is not only a UI convenience; it is how WebMUGEN identifies which runtime layer failed.

The top-level `Settings` page controls Human log capture, AI log capture, Canvas collision boxes, and the lower-left state history independently. All four default to OFF, and OFF stops the corresponding upstream capture/format/render path rather than only hiding markup. See `performance-debug-settings.md`.

These diagnostic controls and their Runtime UI exist only in Development Mode. Public Mode forces their persisted values off and does not request CNS traces, serialize detailed logs, draw collision boxes, or maintain the lower-left diagnostic history. See `build-mode.md`.

## Purpose

The overlay should make the current frame observable across the runtime pipeline:

1. input;
2. command;
3. state;
4. controller execution;
5. physics;
6. animation;
7. round state;
8. compatibility diagnostics.

## Live strip

The live debug strip should show the current frame state.

Typical lines:

```text
keys=ArrowRight
sys R=0
p1 L=0 R=1 U=0 D=0 A=0 PROJ=0
cmd p1=fwd,holdfwd
phys p1 state=20 type=S physics=S ctrl=1 facing=1 life=875 power=0/3000 mul=0.8/1 juggle=4 juggleRemaining=9/15 pos=(220,285) vel=(2.4,0) time=12 anim=20:4
cns p1 state=0->20 anim=0->20 time=0->0 found=1 exec=ChangeState,VelSet,ChangeAnim
```

Each line should answer a specific question:

The live physics line shows `life`, `power=current/max`, and the current `attack/defense` multiplier pair as `mul`. This keeps a stalled KO route distinguishable from a failed State trigger or a non-finite damage value. Canvas renders a bottom Power gauge from the same PlayerState values; a value change emits `raw.power_hud` with both ratios and resolved widths.

| Line | Question answered |
|---|---|
| `keys=` | Did the browser see the key? |
| `p1 ...` | Did the key become player input? |
| `cmd p1=` | Did CMD resolution produce command names? |
| `phys p1=` | What is the post-physics player state? |
| `cns p1=` | What did CNS runtime do this frame? |
| `round=` | What is the current round phase? |
| `score=` | What is the current score/result state? |

## Character Files tab

The Debug UI is split into top-level pages. The game canvas, runtime logs, manual, and settings live under the play/runtime page. The second page is named `Character Files` and contains only the loaded character file browser. Top-level page switching keeps the game panel and canvas mounted because `CanvasRenderer` owns that canvas reference for the running loop. The file browser unmounts while inactive and remounts when reopened.

`Character Files` is always visible while its page is selected; it has no Show/Hide control. It inventories all files under an HTTP character's DEF directory and all entries in a ZIP character archive. MUGEN source extensions receive their MPS-compatible syntax colors. Other text files remain selectable and editable without a generated outline. Binary files that do not have a dedicated viewer remain listed but read-only.

Text files can be switched into Edit mode and saved from the same pane during local Vite development. Save preserves the project's Shift-JIS character-file convention. Direct files are restricted to `public/chars`, while ZIP entries are saved by rebuilding the character archive. A deployed static build does not expose the development save endpoint.

Files are grouped under `Character` and `Engine` headings instead of using location-dependent colors. Labels are paths relative to the character DEF directory, so nested assets remain distinguishable. Extension colors are stable across both groups: AIR is red, ACT orange, DEF green, SFF/SND purple, CNS vivid blue, CMD yellow, and other files retain the neutral color. Active and hover states stay within each extension's color family; neutral files use a restrained blue-gray state instead of the CNS selection color. Direct files are editable only when the local development save endpoint can map them safely under `public/chars`. The initial list height fits every file and remains manually resizable.

Source scrolling is remembered per file; changing tabs or switching files must not reuse another file's scroll position. The Map/source divider, file-list height, and source-view height are draggable and keyboard adjustable. The Map list consumes the available panel height rather than retaining an unrelated fixed cap.

Editing can be cancelled. Cancelling or selecting another file while the draft differs from the loaded source requires explicit discard confirmation. Syntax coloring is selectable; `VS Code Dark 2026` is the default, with MPS Classic and monochrome alternatives. DEF, CNS, AIR, and IKEMEN ZSS scopes mirror the latest MugenPowerStudio TextMate grammars (`01_mugen_def`, `02_mugen_cns`, `03_mugen_air`, and `10_ikemengo_zss`). ZSS files retain distinct scopes for comments, strings, numeric constants, variables, control words, trigger functions, redirects, controllers/parameters, modifiers, and operators.

The file list is shown as a compact multi-column list above the source reader. The source reader itself is on the next row with a summary pane on the left and text on the right. Every non-SFF Map has a label/line search, and text source has a case-insensitive string search with previous/next navigation. The summary pane exposes useful jump points such as AIR `Begin Action`, CNS `StateDef`, CMD `Command`, and DEF sections. CNS maps use a collapsed one-level tree: each `StateDef` is a parent and every owned State Controller is its child, labeled with `type` and header name. Disclosure buttons open individual parents; `Expand all` and `Collapse all` control the complete tree. Parent and child source items both jump to their corresponding source line.

In read mode, constant integer `anim` assignments and `value` assignments owned by a `ChangeAnim` or `ChangeAnim2` controller link to the matching AIR `Begin Action`. Constant integer `stateno`, `p1stateno`, and `p2stateno` assignments and `value` assignments owned by a `ChangeState` controller link to the matching CNS/CMD `StateDef`, preferring the current file when duplicate State numbers exist. A `p2stateno` destination is linked only when that StateDef exists in the currently loaded character files; the viewer cannot statically resolve another character's StateDef when `p2getp1state = 0`. Navigable values use a subtle underline. Expressions are left as plain highlighted text because their runtime result cannot be resolved statically. These links are disabled in edit mode. The editor keeps a visible line-number gutter aligned with the syntax-highlight layer.

Navigation destinations are indexed once per loaded file set rather than rescanning every CNS/AIR file for every numeric assignment. Read mode virtualizes text files above 2,000 lines into an 800-line window with height-preserving spacers; a selected runtime-log destination is mounted immediately, and manual scrolling moves the window. Editing retains the complete textarea. This keeps large single-file characters such as itoko responsive without changing StateDef/AIR resolution priority or source line numbers.

The source line-number gutter is interactive in read mode. Clicking a line number, an inline source link, a Map item, a search result, or another source-opening control selects and highlights its destination line. Highlighted locations are recorded in a bounded, newest-first View History in the Map pane. Reopening an existing location moves it to the front instead of creating duplicates, and each history entry links back to its retained file and line. A draggable, keyboard-adjustable horizontal splitter allocates height between the Map and View History while preserving a usable minimum for both. The history is cleared when another character is loaded.

Selected text in the source reader keeps the browser's native Ctrl+C / Command+C copy behavior. When no text is selected, Ctrl+C remains the WinMUGEN-compatible collision-box shortcut.

AIR files also include a small debug animation preview. The preview uses the loaded AIR action and sprite pack when sprites are available, and falls back to a missing-sprite label when an element cannot be drawn. This is a diagnostic aid for checking whether the AIR action and SFF sprite references line up.

SFF files have a dedicated single-sprite browser. The complete sprite Map is available without a 600-item cutoff and is grouped by group number. Groups start collapsed, disclose their `group,image` children, support search, and have expand-all/collapse-all actions. The preview canvas keeps its intrinsic aspect ratio so sprites are never stretched by the panel dimensions. The selected group/image initially fits in the viewport while preserving its registration origin, can be zoomed from 10% to 800%, and can be panned by dragging. Zoom and pan are shared by every sprite in the Character Files viewer and do not reset on group/image or SFF-file changes; `Fit / Center` resets them explicitly. Metadata reports group/image, dimensions, X/Y registration coordinates, link and palette ownership, applied palette key/source, ACT path when applicable, and palette index order. The retained effective palette is also shown as 256 swatches. The primary SFF uses the already-loaded sprite pack so its preview reflects the selected DEF palette; another SFF is decoded from its retained archive bytes. SFF v2 remains unsupported by the engine and viewer.

SND v1 files use the existing compatibility parser to list samples by group and index. The Map is searchable and grouped with the same disclosure controls. Selecting a RIFF/WAVE sample creates a temporary browser audio URL and exposes native playback controls; empty or unknown-format payloads remain inspectable but are not advertised as playable.

ACT files show their MUGEN-index-order palette and apply the selected ACT to retained indexed pixels from sprite `0,0`. If `0,0` is absent or undecodable, the first decodable group-0 sprite is used and its actual group/image number is shown. Indexed pixels are retained for only that best preview candidate to avoid duplicating the full SFF pixel memory solely for this inspection feature.

## Settings page

`Settings` is a top-level page beside `Game / Runtime` and `Character Files`; it is not part of the runtime-log tab row. Character loading, runtime behavior, audio, and input configuration remain on this page. Runtime and audio controls are grouped into labeled cards so checkboxes, descriptions, selectors, and action buttons retain a consistent relationship at wide and narrow viewport sizes. The control summary is a child card of `Input Config`, alongside the live input monitor and per-player mappings.

Settings are loaded through the unified `webmugen.settings.v1` model after publisher defaults from `public/config/default-settings.json`. The Settings page can reset every browser-owned setting, including input mappings, to the latest publisher defaults after confirmation. Live Life, Power, State, round, entity, and log data never enters the persisted model. See `settings.md`.

`Logical screen size` selects the persisted Canvas profile. `WinMUGEN Hi-Res 640x480 (320x240 coordinates)` is the default compatibility-oriented view: the Canvas is physically 640x480 while CNS screen coordinates remain 320x240 and render at 2x. `Wide 960x540 (16:9)` preserves the former broad 1x view. A change reloads the current match because the logical dimensions are also supplied to CNS screen-relative evaluation. Stored values from the former `winmugen-320x240` option migrate to the Hi-Res profile.

## WinMUGEN-compatible system shortcuts

The Controls tab lists every shortcut implemented by the browser runtime. System shortcuts are handled separately from configured character input and do not skip the round intro.

- F1 / Ctrl+F1: set P2 / P1 life to zero.
- F2 / Ctrl+F2 / Shift+F2: set both / P1 / P2 life to one.
- F3: fill both root-player power gauges.
- F4: rebuild the current round without advancing its number. Shift+F4 reloads the character and starts the match again.
- F5: enter the normal time-over result flow using the current life totals.
- F8: clear retained runtime logs. F12 downloads the current canvas as PNG.
- Ctrl+C / Ctrl+D / Ctrl+L: toggle collision boxes, runtime-history display, and the Canvas HUD.
- Ctrl+I: put roots and active Helpers into State 0 with `Ctrl = 0`.
- Ctrl+S: toggle fast-forward.
- Space: restore root/Helper life and power and reset a fighting round's timer.
- Pause / Scroll Lock: pause the simulation and advance one frame while paused.

The Controls tab explicitly marks Ctrl+number AI switching, Ctrl+Alt+number player removal, and Ctrl+V VSync switching unsupported. WebMUGEN does not yet expose WinMUGEN-style player-slot AI/removal controls, and browser animation-frame scheduling owns VSync.

## Runtime history tab

Runtime history records snapshots over time. It exists because live values disappear too quickly during movement and transitions.

History entries should be snapshots, not references to mutable arrays or objects. Past entries must not change when the current frame changes.

Runtime history is exposed as top-level tabs:

- `実行履歴人間用`: compact StateNo / AnimNo / State状況 view plus the StateNo transition list.
- `実行履歴AI用`: dense copyable diagnostics for Codex/debug work.

The human view normally shows the CNS-post, pre-physics state so `Time = 0` controller routes are visible on the frame a StateDef is entered. HitDef custom-state destinations are committed after the ordinary physics pass; those entries use the post-collision state and append their external Time=0 trace, so short-lived routes such as T-H-M-A `0 -> 3425 -> 3434` are not omitted from readable history.

Helper detail logs evaluate triggers with that Helper's MUGEN ID, unique entity ID, root/parent relation, committed sibling count, and redirect resolver. Thus `IsHelper(ID)`, `Root`, `Parent`, `Helper(ID)`, and `PlayerID(ID)` results shown in the human log match the runtime entity context instead of being reconstructed as root-player expressions.

## Investigation tab / notes

Investigation notes should live in source docs or tests once they become stable knowledge. The old UI notes tab is no longer part of the main debug tab row.

## Adding diagnostics

When adding diagnostics, prefer short structured lines over a single huge line.

Good:

```text
STATE10 03 triggerall command="holddown"=T result=T
STATE10 04 group1 statetype=S=T ctrl=T result=T
STATE10 05 final all=T anyGroup=T shouldRun=T
```

Hard to use:

```text
one very long line containing every trigger and controller and state value
```

## Noise control

Temporary debug logs are allowed during investigation, but long-term overlay output should remain readable.

Debug-only CNS formatters must also be gated before invocation. Issue #58 Phase 2 prevents
`debugControllerCheck` from re-evaluating crouch-route Triggers when trace diagnostics are disabled;
the normal controller decision is evaluated once and no diagnostic string or diagnostic Trigger
result is produced. Enabling the relevant trace keeps the existing detailed output and its diagnostic
re-evaluation behavior. Trigger compilation and grouping caches are separate later phases.

Keep logs when they help future compatibility work. Remove or narrow logs that only explain a solved one-off bug.

For large characters, cap rendered history by both entry count and line count. Prefer retaining ChangeState and ChangeAnim candidates before less route-critical controller details.

AI runtime history stores compact event snapshots rather than repeating the complete live overlay. Input, command, post-step physics, round/score, and one CNS trace summary are retained. The redundant CNS overlay/detail headers, `dbg` pseudo-controller copies, routine `finish`/`pipe`/`return` plumbing, zero-valued restart status, and empty hit-diagnostic placeholders are omitted. Specialized route diagnostics such as `STATE10` and event diagnostics for HitDef, Projectile, Explod, audio, pause, and rendering remain available when emitted.

A frame containing only routine trace completion is not retained. The AI tab shows the latest 12 entries and at most 400 lines at once; the retained AI buffer keeps the latest 1,000 entries for full-log copying. Human-readable history keeps its separate limits and presentation.

The runtime-history tabs render a visible window instead of the full retained history. The default window is the latest entries. Clicking a StateNo transition frame switches the window to that frame's surrounding entries before scrolling, so old retained frames can still be inspected without keeping the whole history in the DOM. The UI should show the current window mode, displayed range, visible count, retained count, and a `最新へ戻る` action when inspecting an older frame.

Retained runtime-history lines should stay outside React render state. React should track only visible-window controls, lightweight index rows, selected detail entries, and invalidation counters; otherwise every appended log copies and reconciles thousands of retained lines even when the DOM window is capped.

The human runtime-history view should use a frame index on the left and a selected one-entry detail pane on the right. A draggable splitter changes the width allocated to those regions. The selected detail switches among P1, P2, and Helpers with compact tabs, including each entity's State, emphasized Anim, Time, and Trigger/controller evaluation. The compact entity panel omits the `keys=` summary, while the retained/raw diagnostics keep it available for input-pipeline investigations. The index is populated whenever a human detail log is generated, including frames where StateNo did not change in the broader retention modes. The `State transition` mode filters before detailed formatting and retains only frames where a root or Helper trace has different before/after StateNo values. If one frame crosses multiple P1 StateNo values, retain separate entries keyed by `frameNo + StateNo`. Clicking an index row loads that retained P1/P2/Helper detail from the non-rendering store. New log entries must not automatically replace the selected detail pane. Latest-log following is controlled by one checkbox.

Every retained frame index also lists the Helpers currently on stage with root owner, Helper/entity id, StateNo, and optionally AnimNo. Helpers present in the latest retained frame receive State/Anim columns to the right of P1/P2; a destroyed Helper is removed from the live columns while its historical detail remains selectable from its retained frame. Frame-index Anim values are display-only. The selected detail uses compact P1, P2, and per-Helper tabs; one thin-bordered entity panel is rendered at a time, including the selected Helper's own StateDef and controllers. The header is a plain timestamp/frame line, without a separate latest-frame button or duplicated player/opponent State summary. The entity panel starts with `StateDef + Time`; the indented child row contains `Anim + StateDef parameters`, avoiding a redundant `P1/P2 StateNo` metadata row. StateDef and Anim are clickable badges with hover feedback; StateDef opens the CNS source and Anim opens the AIR `Begin Action`. StateDef fields, controller triggers, and controller parameters use separate collapsed disclosures, with `value`, `hitsound`, and other non-trigger fields kept inside Parameters instead of the controller title. Human-log retention is selectable between every frame, Trigger ON/OFF changes, StateNo transitions, and frames where at least one State Controller actually executed. Trigger-change retention ignores timestamps, Time-only value summaries, and evaluated parameter changes, but records Helper spawn/destruction. Stores remain bounded even in every-frame mode.

The selected State detail lists every controller in that State. Controller headers use exact runtime execution references (`StateNo + source + controller index`) to distinguish actual execution from merely true Triggers. Headers show `作動` / `非作動`; Trigger rows start collapsed and open from the disclosure button. The StateNo badge and StateDef link both open the beginning of the corresponding source StateDef. The detail pane has no nested Hide control.

Human-readable detail entries include a `StateDef` source link. Clicking it should open `Character Files` at the StateDef header line so the active state can be inspected quickly.

The human detail pane and `Character Files` have no nested Show/Hide controls. `Character Files` is controlled by its top-level page.

When a runtime detail link opens a source location, the UI should switch to the `Character Files` page and scroll to the requested file and line.

Runtime log tabs should provide a clear action that drops retained human and AI logs together. This is for long debugging sessions where retained history is no longer useful and memory/DOM pressure should be reset.

Human-facing State status entries can be much larger than AI entries, so the rendered window needs a line-count cap in addition to the entry-count cap.

## Copy buttons

Copy buttons should provide:

- current visible runtime-history window;
- full retained runtime-history log;
- current live screen information when included in a dump;
- static route lists when included in a dump.

The copied text should be sufficient to diagnose the current issue without needing a screenshot.

AI runtime hit diagnostics can be disabled in Runtime Settings. When enabled, they expose the ActiveHitDef identifier, evaluated damage pair and source, collision result, Life before/after, fixed reaction sources, and lifecycle events without adding the same lines every frame.

Hit-pause diagnostics show the event-time attacker/defender counters and the live physics line includes each player's remaining `hitPause`. During positive pause, CNS trace records `hitpause skip`, making stopped controllers distinguishable from failed triggers.

The physics line exposes the current attack StateDef `juggle` cost and the defender's `juggleRemaining/juggleMax` pool. A rejected air follow-up is paired with `raw.hit_juggle ... reason=insufficient_points` in AI runtime history.

The same line exposes resolved guard intent as `guard=back`, `guard=back+down`, or `guard=-`. Guard acceptance/rejection details remain in the structured `raw.guard_check` history record.

Custom-state ownership appears as `owner=current/self`, using stable player ids rather than P1/P2-specific branches. Borrowed-state entry, SelfState return, and missing owner State details are recorded by `raw.custom_state`.

Player asset resolution is recorded by `raw.render`. It exposes `state`, `anim`, `stateOwner`,
`animOwner`, AIR element/sprite ids, `spriteExists`, `playerVisible`, `rendererDrawRequested`, and a
reason when drawing is skipped. Missing actions, missing elements, missing sprites, intentional
negative sprite references, and `AssertSpecial invisible` must remain distinguishable. These lines are
part of the copied AI runtime dump used for Issue #55 user verification.

Canvas collision debug uses the same AIR world-coordinate boxes as the hit resolver. Labels identify attack/body kind, box index, default versus element source, animation number, and current element index; boundaries include player position, facing, and AIR element offsets.

When `Collision boxes` is OFF, Canvas never enters the player/helper/projectile debug rectangle path. The lower-left history has its own setting and remains a separate 5 Hz lightweight stream.

Issue #57 adds a blue Push Box using the same `[Size]`-derived rectangle as the stage solver. `raw.push` exposes owner, ground/air mode, character/default source, resolved edges, front/back/height, overlap, `PlayerPush`, and apply/skip result. `raw.cross` exposes airborne state, both players' per-tick `noAutoTurn` flags, and Facing before/after so an unintended auto-turn is visible in the copied runtime history. AutoTurn is eligible only while grounded in State 0/11 with `MoveType = I`; an executed turn also appears as Anim 5/6 in the normal State/Anim trace while Ctrl remains enabled.

Runtime Settings `Power Infinite` is separate from CNS compatibility. The Canvas power gauge displays `∞` for each selected root player, while `raw.power_hud infinite=off|p1|p2|both` exposes the current selection. An actual refill or mode transition produces `raw.power_infinite timing=frame_start` with the real before/after and `powerMax`; normal controller and HitDef power diagnostics continue to show later mutations in that frame.

Issue #65 adds `raw.target_composite_trigger` for controllers that combine a target redirect with `PrevStateNo` or MoveContact-family conditions. It records State/PrevState, MoveContact/MoveHit/MoveGuarded, registered `hitDefId -> runtime player` targets, requested target id, resolved entity/State/MoveType, every trigger record result, the numbered-group aggregate, ChangeState target, and control request. A missing redirect is printed as `targetRedirectFound=0` and `SFalse` rather than silently reading self/opponent.

Issue #66 adds a generic `raw.trigger` record for every controller trigger containing `enemy`, `enemynear`, `enemy(n)`, `enemynear(n)`, or another supported redirect. It reports source file/line, State/controller, trigger group/line, original expression, parser/evaluator classification, redirect and argument, resolved entity, actual child value, result, `selfFallback=0`, aggregate result, ChangeState value/executed/terminal flags, and the ActiveHitDef id. This makes a negative-State re-entry distinguishable from a current-State transition.

## Minimum useful dump

A useful dump includes:

- `keys=`;
- `cmd p1=` and `cmd p2=`;
- `phys p1=` and `phys p2=`;
- `cns p1=` and `cns p2=`;
- the relevant DEF/CMD/CNS source locations from `Character Files`;
- runtime history around the failing frames.
