# Explod Integration Design

Updated: 2026-07-13

This document records the Issue #25 audit and the integration contract for the Explod roadmap. Issues #30-#33 connect creation, rendering, baseline lifecycle, and explicit-ID modification; Issues #38/#39 connect explicit-ID removal and bind-time changes.

## Issue #30 implementation status

Production `GameState` owns an `ExplodRuntimeState` with a monotonically allocated `runtimeId` independent from duplicate-capable MUGEN `id`. The normal `CnsStateRuntime` executor evaluates an Explod controller on its firing frame and emits an owner-scoped creation snapshot. The app coordinator applies that snapshot to `GameState.explods` and records `raw.explod_create` or `raw.explod_create_rejected` in Runtime History.

The snapshot includes owner/animation source, anim, postype, resolved initial stage or screen position, Facing/vfacing, bind/removetime metadata, draw order, and the movement/render/pause fields scheduled for later Issues. P1/P2 ownership, duplicate MUGEN ids, expressions, all legacy postypes, invalid anim, round reset, and bundled KFM State 191 are covered by focused tests.

Issue #31 resolves each visible entry through its owner-scoped AIR/SFF assets, applies world/screen conversion and Facing/vfacing once, and submits regular or `ontop` draw layers. Issue #32 advances age/AnimElem/time, implements exact creation-tick counting for removetime 0/positive/-1/-2, follows bind owners for the configured tick count, releases to the last world position, and removes entries before rendering. Issue #33 evaluates `ModifyExplod`; Issue #38 evaluates `RemoveExplod`; Issue #39 evaluates `ExplodBindTime` in the same ordered controller event stream. Bind time 0 releases immediately, positive values use the existing finite lifecycle, and negative values persist; an unbound P1/P2-postype Explod can rebind from its stored owner-relative offset. Missing ids are diagnosed safe no-ops. Missing AIR actions or sprites remain hidden with diagnostics. Velocity/acceleration stepping remains #34; Pause/SuperPause gating remains #35. Omitted controller-id semantics, non-player owner disappearance/reload, `random`, non-zero camera runtime, fightfx asset loading, generic controller `persistent`, and `NumExplod` remain Partial.

## Audited implementation inventory

| Existing code | What works | Production status | Decision |
|---|---|---|---|
| `core/explod/ExplodSystem.ts` | Owner-scoped production runtime entries, separate runtime/MUGEN ids, ordered create/modify/remove/bind-time application, lifecycle, and diagnostics. | Connected to `GameState`, normal CNS effect controllers, the app coordinator, lifecycle, and renderer by #30-#33/#38/#39. | Use as the durable model for #34 onward. |
| `core/runtime/RuntimeEventQueue.ts` | Defines prototype `explod` and `removeExplod` events. | No queue is owned or drained by the production CNS/game loop. Events lack owner identity and coordinate/animation ownership. | Reuse the event boundary concept. Replace the Explod payload with an owner-scoped request. |
| `core/cns/CnsRuntimeEventAdapter.ts` | Converts literal `Explod`/`RemoveExplod` parameters in isolation. | Not called by `CnsStateRuntime`; does not use the normal CNS expression context. | Do not connect directly. Move parameter evaluation into the normal controller executor and emit the shared request type. |
| `core/cns/CnsRuntimeSideEffectsPhase55.ts` | Recognizes Explod and emits an untyped command payload. | Not called by `CnsStateRuntime`; duplicates the event adapter. | Deprecation candidate after the production controller path exists. Keep until replacement tests cover its useful cases. |
| `core/runtime/RuntimeExplodIntegration.ts` | Applies prototype add/remove events relative to one supplied owner. | Not called by the app; assumes one external owner and conflates ids. | Reuse coordinate conversion test ideas, not the current public signature. |
| `core/hitdef/HitRuntimeEvents.ts` | Can describe a hit spark as the prototype Explod event. | The production HitDef path uses `HitEvent.spark`/`HitFeedback`, not this event path. | Keep separate until Issue #36 deliberately selects the shared effect path. Do not silently reroute hit sparks in Issue #30. |
| `CanvasRenderer` | Resolves AIR animation elements and draws player/projectile sprites. | Issue #31 adds an explicit Explod effect layer with owner asset selection, priority/ontop ordering, and diagnostics. | Keep lifecycle mutation outside the renderer; it consumes immutable runtime entries. |
| CNS compatibility shims | `NumExplod` returns zero. | The trigger remains a safe default with no collection lookup. | Keep Matrix status honest until the production trigger path is connected and tested. |

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

`runtimeId` and `mugenId` must never be aliases. Explicit-ID `ModifyExplod`, `RemoveExplod`, and `ExplodBindTime` select every entry in the exact owner scope with the matching MUGEN id; internal code still uses `runtimeId` for one exact entry. Duplicate MUGEN ids remain representable. Omitted-ID selection is intentionally a diagnosed safe no-op until a reliable WinMUGEN boundary rule is established. NumExplod selection remains later work.

`GameState` will own one `explods: ExplodRuntimeState`. Round creation/restart creates an empty state. Character State changes do not delete owned Explods unless a controller parameter or WinMUGEN lifecycle rule requests it. Destroyed Helper cleanup removes or detaches its entries according to the later owner-removal compatibility decision.

## Production data flow

```text
CNS controller trigger passes
  -> controller executor evaluates parameters with the normal CNS context
  -> owner-scoped Explod create/modify/remove/bind-time request is appended to one ordered frame stream
  -> game coordinator applies each request in CNS controller order to GameState.explods
  -> Explod step resolves bind, animation and removal (#32), then movement (#34)
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
- ModifyExplod preserves every omitted parameter. Changing `pos` or `postype` re-resolves position and bind metadata immediately; changing `anim` restarts progress only when the animation number/source differs.
- Changing `removetime` resets its independent elapsed clock on the modification frame. This does not reset Explod age or unchanged animation progress.

## Pause, stepping, and cleanup contract

- Normal frames advance bind, velocity, acceleration, `animTime`, age, and `removetime` once.
- Pause and SuperPause freeze an entry unless its remaining `pauseMoveTime`/`superMoveTime` permits movement. Exact decrement order is implemented with Issue #35 and covered by boundary tests.
- `removetime = -1` maps to persistent (`null`) storage. Other negative special values are not guessed; keep them diagnosed/Partial until specified.
- Round restart creates an empty Explod collection and resets `nextRuntimeId` deterministically.
- A removed entry is absent before rendering in the same frame when removal is applied before the step/render pass.
- Explicit RemoveExplod filters all exact owner/id matches immediately. Later same-frame modify/bind operations therefore cannot find removed entries; an earlier modify is observable before a later removal diagnostic.
- ExplodBindTime replaces only bind duration/target metadata. Time 0 releases at the current world position; positive time follows for the finite lifecycle; negative time follows indefinitely. Rebinding resolves the stored postype/offset against the current owner/opponent.

## Issue boundaries

1. **#30**: completed owner-scoped runtime model in `GameState`, expression-aware CNS creation, separate runtime/MUGEN ids, round cleanup, and Runtime History diagnostics; no renderer claim.
2. **#31**: resolve owner AIR animation, position, Facing, and render layer in Canvas.
3. **#32**: animation progression, `removetime`, bind lifecycle, and pause-independent baseline stepping. Implemented with finite/loop/infinite AIR boundary coverage and real-character evidence.
4. **#33**: completed owner-scoped explicit-ID ModifyExplod partial updates, duplicate selection, same-frame coordinate/render reflection, and independent removetime reset. Omitted-ID selection remains a documented limitation.
5. **#38**: completed owner-scoped explicit-ID RemoveExplod selection, duplicate removal, ordered event application, same-frame renderer exclusion, and diagnostics. Omitted-ID selection remains a documented limitation.
6. **#39**: completed owner-scoped explicit-ID ExplodBindTime selection, duplicate updates, zero/positive/negative lifecycle, unbound rebind, ordered removal interaction, and diagnostics. Omitted-ID and non-player owner lifecycle remain documented limitations.
7. **#34**: transparency, scale, ownpal, velocity, and acceleration.
8. **#35**: Pause/SuperPause move-time integration.
9. **#36**: deliberately converge HitDef spark/sound effects with the completed runtime where compatible.

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
- explicit-ID ModifyExplod preserves omitted values, updates all owner-scoped duplicates, and cannot mutate the other owner;
- missing and omitted ModifyExplod ids are diagnosed safe no-ops;
- explicit-ID RemoveExplod deletes every owner-scoped duplicate before lifecycle/render, while missing/omitted ids remain diagnosed no-ops;
- create/modify/remove requests preserve CNS controller order;
- explicit-ID ExplodBindTime updates every owner-scoped duplicate and covers zero, finite, indefinite, rebind, follow, release, and removed-entry ordering;
- real-character CNS data is exercised before any controller row becomes Complete.

Standalone `ExplodSystem` tests are not sufficient evidence for Matrix promotion. A feature is Complete only after its CNS controller, `GameState`, step, renderer or other required consumer, diagnostics, focused tests, and real game path are connected.
