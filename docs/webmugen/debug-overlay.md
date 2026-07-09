# Debug Overlay

Updated: 2026-07-09

The Debug Overlay is part of the compatibility workflow. It is not only a UI convenience; it is how WebMUGEN identifies which runtime layer failed.

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
phys p1 state=20 type=S physics=S ctrl=1 facing=1 pos=(220,285) vel=(2.4,0) time=12 anim=20:4
cns p1 state=0->20 anim=0->20 time=0->0 found=1 exec=ChangeState,VelSet,ChangeAnim
```

Each line should answer a specific question:

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

`Character Files` shows loaded character text files and the applied common CNS. It should span the full static-info width so long CNS/AIR files remain readable. Source scrolling is remembered per file; changing tabs or switching files must not reuse another file's scroll position.

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

Keep logs when they help future compatibility work. Remove or narrow logs that only explain a solved one-off bug.

For large characters, cap rendered history by both entry count and line count. Prefer retaining ChangeState and ChangeAnim candidates before less route-critical controller details.

The runtime-history tabs render a visible window instead of the full retained history. The default window is the latest entries. Clicking a StateNo transition frame switches the window to that frame's surrounding entries before scrolling, so old retained frames can still be inspected without keeping the whole history in the DOM. The UI should show the current window mode, displayed range, visible count, retained count, and a `最新へ戻る` action when inspecting an older frame.

## Copy buttons

Copy buttons should provide:

- current visible runtime-history window;
- full retained runtime-history log;
- current live screen information when included in a dump;
- static route lists when included in a dump.

The copied text should be sufficient to diagnose the current issue without needing a screenshot.

## Minimum useful dump

A useful dump includes:

- `keys=`;
- `cmd p1=` and `cmd p2=`;
- `phys p1=` and `phys p2=`;
- `cns p1=` and `cns p2=`;
- static StateDef and Command route lists;
- runtime history around the failing frames.
