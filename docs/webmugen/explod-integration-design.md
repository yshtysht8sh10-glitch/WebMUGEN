# Explod Integration Design

Updated: 2026-07-13

This document records the Issue #25 audit and the integration contract for the Explod roadmap. Issue #30 now connects the creation boundary described here; rendering and lifecycle evidence remain assigned to #31/#32.

## Issue #30 implementation status

Production `GameState` owns an `ExplodRuntimeState` with a monotonically allocated `runtimeId` independent from duplicate-capable MUGEN `id`. The normal `CnsStateRuntime` executor evaluates an Explod controller on its firing frame and emits an owner-scoped creation snapshot. The app coordinator applies that snapshot to `GameState.explods` and records `raw.explod_create` or `raw.explod_create_rejected` in Runtime History.

The snapshot includes owner/animation source, anim, postype, resolved initial stage or screen position, Facing/vfacing, bind/removetime metadata, draw order, and the movement/render/pause fields scheduled for later Issues. P1/P2 ownership, duplicate MUGEN ids, expressions, all legacy postypes, invalid anim, round reset, and bundled KFM State 191 are covered by focused tests.

Issue #30 intentionally does not advance animation, bind, removetime, velocity, or acceleration and does not draw the entry. Those are #31/#32/#34 responsibilities. `random`, exact camera space, Helper ownership, fightfx asset lookup, generic controller `persistent`, and `NumExplod` remain Partial.

## Audited implementation inventory

| Existing code | What works | Production status | Decision |
|---|---|---|---|
| `core/explod/ExplodSystem.ts` | Owner-scoped production runtime entries, separate runtime/MUGEN ids, creation application, and diagnostics. | Connected to `GameState`, normal CNS creation, and the app coordinator by #30; render/step remain pending. | Use as the durable model for #31 onward. |
| `core/runtime/RuntimeEventQueue.ts` | Defines prototype `explod` and `removeExplod` events. | No queue is owned or drained by the production CNS/game loop. Events lack owner identity and coordinate/animation ownership. | Reuse the event boundary concept. Replace the Explod payload with an owner-scoped request. |
| `core/cns/CnsRuntimeEventAdapter.ts` | Converts literal `Explod`/`RemoveExplod` parameters in isolation. | Not called by `CnsStateRuntime`; does not use the normal CNS expression context. | Do not connect directly. Move parameter evaluation into the normal controller executor and emit the shared request type. |
| `core/cns/CnsRuntimeSideEffectsPhase55.ts` | Recognizes Explod and emits an untyped command payload. | Not called by `CnsStateRuntime`; duplicates the event adapter. | Deprecation candidate after the production controller path exists. Keep until replacement tests cover its useful cases. |
| `core/runtime/RuntimeExplodIntegration.ts` | Applies prototype add/remove events relative to one supplied owner. | Not called by the app; assumes one external owner and conflates ids. | Reuse coordinate conversion test ideas, not the current public signature. |
| `core/hitdef/HitRuntimeEvents.ts` | Can describe a hit spark as the prototype Explod event. | The production HitDef path uses `HitEvent.spark`/`HitFeedback`, not this event path. | Keep separate until Issue #36 deliberately selects the shared effect path. Do not silently reroute hit sparks in Issue #30. |
| `CanvasRenderer` | Resolves AIR animation elements and draws player/projectile sprites. | Has no Explod collection or draw pass. | Reuse AIR element lookup and sprite draw primitives in Issue #31; add an explicit effect layer instead of pretending an Explod is a player/projectile. |
| CNS compatibility shims | `Explod`, `ModifyExplod`, `RemoveExplod`, and `ExplodBindTime` are recognized. `NumExplod` returns zero. | Safe no-op only; no game-state effect. | Keep Matrix status honest until each production path is connected and tested. |

No current file needs immediate deletion. `CnsRuntimeSideEffectsPhase55` and the Explod branches of `CnsRuntimeEventAdapter` become removal candidates only after the production controller-to-request path has equivalent focused coverage.

## Runtime ownership model

Explods belong to the match runtime, not to a `PlayerState` array. This permits multiple player, Helper, and future target State owners without copying effects between player objects.

Proposed minimum types:

```ts
type RuntimeEntityRef = {
  entityId: number;       // stable internal player/helper entity identity
  rootPlayerId: 1 | 2;   // team/root ownership for lookup and round cleanup
};

type ExplodRuntimeEntry = {
  runtimeId: number;      // monotonically allocated internal identity
  mugenId: number;        // controller `id`; duplicates are allowed
  owner: RuntimeEntityRef;
  animationOwner: RuntimeEntityRef;
  animNo: number;
  animTime: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  facing: 1 | -1;
  verticalFacing: 1 | -1;
  coordinateSpace: 'owner' | 'stage' | 'screen';
  bind: { remaining: number; offsetX: number; offsetY: number } | null;
  age: number;
  removeTime: number | null;
  pauseMoveTime: number;
  superMoveTime: number;
  removeOnGetHit: boolean;
  spritePriority: number;
  render: {
    transparency?: string;
    scaleX: number;
    scaleY: number;
    ownPalette: boolean;
  };
};

type ExplodRuntimeState = {
  entries: ExplodRuntimeEntry[];
  nextRuntimeId: number;
};
```

`runtimeId` and `mugenId` must never be aliases. `ModifyExplod`, `RemoveExplod`, `ExplodBindTime`, and `NumExplod` select entries by owner scope plus optional MUGEN id; internal code uses `runtimeId` for one exact entry. Duplicate MUGEN ids remain representable.

`GameState` will own one `explods: ExplodRuntimeState`. Round creation/restart creates an empty state. Character State changes do not delete owned Explods unless a controller parameter or WinMUGEN lifecycle rule requests it. Destroyed Helper cleanup removes or detaches its entries according to the later owner-removal compatibility decision.

## Production data flow

```text
CNS controller trigger passes
  -> controller executor evaluates parameters with the normal CNS context
  -> owner-scoped Explod request is appended to the frame result
  -> game coordinator applies requests to GameState.explods
  -> Explod step resolves bind, velocity/acceleration, animation and removal
  -> Canvas effect layer resolves animation through animationOwner AIR
  -> sprite renderer draws at the resolved stage/screen coordinate
  -> Runtime History records request, selection, lifecycle and render lookup
```

The request queue is frame-local output from CNS execution, not durable state. The durable collection lives only in `GameState`. Controller execution must not mutate an unrelated `PlayerState` effect array.

## Coordinate and animation rules

- Controller `pos` is evaluated in CNS/MUGEN coordinates, then converted once according to `postype` and owner Facing.
- Stage Y uses the same MUGEN-to-internal conversion as player position controllers; screen space must not reuse stage ground offsets.
- Owner binding stores an offset and duration. It does not overwrite the Explod's MUGEN id.
- `animationOwner` selects AIR/SFF resources. Initially it equals the creating entity; common fightfx and custom-State animation ownership remain explicit later scopes.
- Renderer receives an already resolved world/screen origin plus the AIR element offset. It must not mutate runtime position.

## Pause, stepping, and cleanup contract

- Normal frames advance bind, velocity, acceleration, `animTime`, age, and `removetime` once.
- Pause and SuperPause freeze an entry unless its remaining `pauseMoveTime`/`superMoveTime` permits movement. Exact decrement order is implemented with Issue #35 and covered by boundary tests.
- `removetime = -1` maps to persistent (`null`) storage. Other negative special values are not guessed; keep them diagnosed/Partial until specified.
- Round restart creates an empty Explod collection and resets `nextRuntimeId` deterministically.
- A removed entry is absent before rendering in the same frame when removal is applied before the step/render pass.

## Issue boundaries

1. **#30**: completed owner-scoped runtime model in `GameState`, expression-aware CNS creation, separate runtime/MUGEN ids, round cleanup, and Runtime History diagnostics; no renderer claim.
2. **#31**: resolve owner AIR animation, position, Facing, and render layer in Canvas.
3. **#32**: animation progression, `removetime`, bind lifecycle, and pause-independent baseline stepping.
4. **#33/#38/#39**: owner-scoped Modify, Remove, and ExplodBindTime selection semantics.
5. **#34**: transparency, scale, ownpal, velocity, and acceleration.
6. **#35**: Pause/SuperPause move-time integration.
7. **#36**: deliberately converge HitDef spark/sound effects with the completed runtime where compatible.

Issue #30 must not absorb #31-#36. Its minimum visible evidence is production `GameState` creation and Runtime History, while visual confirmation begins in #31.

## Test policy

Each implementation Issue adds focused tests at its boundary and a production-loop integration test. Required cases across the roadmap:

- two Explods with the same `mugenId` receive distinct `runtimeId` values;
- identical MUGEN ids owned by different entities do not cross-modify/remove/count;
- P1/P2 and both Facings convert owner-relative position once;
- round restart empties the collection;
- controller trigger false emits no request; trigger true emits exactly one request;
- AIR action lookup uses `animationOwner` and missing actions are diagnosed safely;
- animation/removetime/bind lifecycle has zero/one/off-by-one coverage;
- Pause/SuperPause movement allowances are tested independently;
- renderer consumes resolved coordinates without changing runtime state;
- real-character CNS data is exercised before any controller row becomes Complete.

Standalone `ExplodSystem` tests are not sufficient evidence for Matrix promotion. A feature is Complete only after its CNS controller, `GameState`, step, renderer or other required consumer, diagnostics, focused tests, and real game path are connected.
