# Debug Overlay

Updated: 2026-07-09

The Debug Overlay is part of the compatibility workflow. It is not only a UI convenience; it is how WebMUGEN identifies which runtime layer failed.

Runtime Settings controls Human log capture, AI log capture, Canvas collision boxes, and the lower-left state history independently. All four default to OFF, and OFF stops the corresponding upstream capture/format/render path rather than only hiding markup. See `performance-debug-settings.md`.

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
phys p1 state=20 type=S physics=S ctrl=1 facing=1 power=0 juggle=4 juggleRemaining=9/15 pos=(220,285) vel=(2.4,0) time=12 anim=20:4
cns p1 state=0->20 anim=0->20 time=0->0 found=1 exec=ChangeState,VelSet,ChangeAnim
```

Each line should answer a specific question:

The live physics line shows `power=current/max`. Canvas renders a bottom Power gauge from the same PlayerState values; a value change emits `raw.power_hud` with both ratios and resolved widths.

| Line | Question answered |
|---|---|
| `keys=` | Did the browser see the key? |
| `p1 ...` | Did the key become player input? |
| `cmd p1=` | Did CMD resolution produce command names? |
| `phys p1=` | What is the post-physics player state? |
| `cns p1=` | What did CNS runtime do this frame? |
| `round=` | What is the current round phase? |
| `score=` | What is the current score/result state? |

## Static tab

The static tab should show information that does not change frame-by-frame:

- loaded character source;
- DEF metadata;
- StateDef list;
- CMD command list;
- expected Command → State routes;
- compatibility coverage summary;
- control help.

If a route is missing from the static tab, suspect loader/parser/merge before runtime.

The Debug UI is split into top-level pages. The game canvas, runtime logs, manual, and settings live under the play/runtime page. Static information and `Character Files` live under a separate static/files page so heavy source viewers and AIR previews are not part of the normal play/debug DOM. Top-level page switching keeps the game panel and canvas mounted because `CanvasRenderer` owns that canvas reference for the running loop. Heavy static/files contents unmount while inactive and remount when reopened.

`Character Files` shows loaded character text files and the applied common CNS. It should span the full static-info width so long CNS/AIR files remain readable. Source scrolling is remembered per file; changing tabs or switching files must not reuse another file's scroll position.

The file list is shown as a compact multi-column list above the source reader. The source reader itself is on the next row with a summary pane on the left and text on the right. The summary pane should expose useful jump points such as AIR `Begin Action`, CNS `StateDef`, CMD `Command`, and DEF sections. Summary items jump the text reader to the corresponding source line.

AIR files also include a small debug animation preview. The preview uses the loaded AIR action and sprite pack when sprites are available, and falls back to a missing-sprite label when an element cannot be drawn. This is a diagnostic aid for checking whether the AIR action and SFF sprite references line up.

## Runtime history tab

Runtime history records snapshots over time. It exists because live values disappear too quickly during movement and transitions.

History entries should be snapshots, not references to mutable arrays or objects. Past entries must not change when the current frame changes.

Runtime history is exposed as top-level tabs:

- `実行履歴人間用`: compact StateNo / AnimNo / State状況 view plus the StateNo transition list.
- `実行履歴AI用`: dense copyable diagnostics for Codex/debug work.

The human view shows the CNS-post, pre-physics state so `Time = 0` controller routes are visible on the frame a StateDef is entered.

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

The runtime-history tabs render a visible window instead of the full retained history. The default window is the latest entries. Clicking a StateNo transition frame switches the window to that frame's surrounding entries before scrolling, so old retained frames can still be inspected without keeping the whole history in the DOM. The UI should show the current window mode, displayed range, visible count, retained count, and a `最新へ戻る` action when inspecting an older frame.

Retained runtime-history lines should stay outside React render state. React should track only visible-window controls, lightweight index rows, selected detail entries, and invalidation counters; otherwise every appended log copies and reconciles thousands of retained lines even when the DOM window is capped.

The human runtime-history view should use a frame index on the left and a selected one-entry detail pane on the right. The selected detail displays P1 and P2 side by side, including each player's State/Anim, mapped input summary, and Trigger/controller evaluation; narrow screens stack the two panes. The index is populated whenever a human detail log is generated, including frames where StateNo did not change. If one frame crosses multiple P1 StateNo values, retain separate entries keyed by `frameNo + StateNo`. Clicking an index row loads that retained P1/P2 detail pair from the non-rendering store. New log entries must not automatically replace the selected detail pane; use the latest-frame action for that.

Human-readable detail entries include a `StateDef` source link. Clicking it should open `Character Files` at the StateDef header line so the active state can be inspected quickly.

The human detail pane and `Character Files` pane can be hidden with Show/Hide controls. This keeps heavy State status markup and source/AIR preview canvases out of the DOM during long debugging sessions. `Character Files` must still be openable from a button even when no StateDef source link has been clicked.

When a runtime detail link opens a source location, the UI should switch to the static/files page, reveal `Character Files`, and scroll to the requested file and line.

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

Issue #57 adds a blue Push Box using the same `[Size]`-derived rectangle as the stage solver. `raw.push` exposes owner, ground/air mode, character/default source, resolved edges, front/back/height, overlap, `PlayerPush`, and apply/skip result. `raw.cross` exposes airborne state, both players' per-tick `noAutoTurn` flags, and Facing before/after so an unintended auto-turn is visible in the copied runtime history.

Runtime Settings `Power Infinite` is separate from CNS compatibility. The Canvas power gauge displays `∞` for each selected root player, while `raw.power_hud infinite=off|p1|p2|both` exposes the current selection. An actual refill or mode transition produces `raw.power_infinite timing=frame_start` with the real before/after and `powerMax`; normal controller and HitDef power diagnostics continue to show later mutations in that frame.

Issue #65 adds `raw.target_composite_trigger` for controllers that combine a target redirect with `PrevStateNo` or MoveContact-family conditions. It records State/PrevState, MoveContact/MoveHit/MoveGuarded, registered `hitDefId -> runtime player` targets, requested target id, resolved entity/State/MoveType, every trigger record result, the numbered-group aggregate, ChangeState target, and control request. A missing redirect is printed as `targetRedirectFound=0` and `SFalse` rather than silently reading self/opponent.

Issue #66 adds a generic `raw.trigger` record for every controller trigger containing `enemy`, `enemynear`, `enemy(n)`, `enemynear(n)`, or another supported redirect. It reports source file/line, State/controller, trigger group/line, original expression, parser/evaluator classification, redirect and argument, resolved entity, actual child value, result, `selfFallback=0`, aggregate result, ChangeState value/executed/terminal flags, and the ActiveHitDef id. This makes a negative-State re-entry distinguishable from a current-State transition.

## Minimum useful dump

A useful dump includes:

- `keys=`;
- `cmd p1=` and `cmd p2=`;
- `phys p1=` and `phys p2=`;
- `cns p1=` and `cns p2=`;
- static StateDef and Command route lists;
- runtime history around the failing frames.
