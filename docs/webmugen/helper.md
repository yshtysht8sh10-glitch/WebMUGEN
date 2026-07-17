# Helper runtime compatibility

Issue #58 Phase1 introduces a real Helper entity collection without replacing the existing P1/P2 adapter. A Helper is not an Explod and is not inserted into `GameState.players`.

Each entry separates its unique runtime `entityId` from the MUGEN `helperId`; duplicate MUGEN IDs are valid. It records `rootEntityId`, `parentEntityId`, character/State/animation ownership, `keyctrl`, `ownpal`, spawn frame, and an independent PlayerState containing StateNo, PrevStateNo, StateTime, StateDef fields, position, velocity, Facing, Anim/AnimTime, and variable maps.

The Phase1 frame order is:

1. evaluate the two root players and the Helper snapshot that existed at frame start;
2. collect Helper and DestroySelf requests without mutating the collection;
3. remove destroyed entities and append spawned entities with monotonic runtime IDs;
4. skip State/physics stepping for newly spawned entities in that frame;
5. begin their normal owner-CNS State pass on the next frame;
6. include surviving Helpers in owner-scoped AIR/SFF rendering.

`NumHelper` reads the committed frame-start collection for the current root, with optional MUGEN ID filtering. `IsHelper` distinguishes a Helper evaluation context from a root player. `DestroySelf` only removes the executing Helper; it does not destroy a root player. `raw.helper` reports spawn/destroy identity, ownership, State, Anim, frame, and first-step timing. Round restart creates an empty collection and resets the runtime allocator.

Phase1 is intentionally Partial. Root/parent/helper redirect expressions, ParentVar/Bind, complete keyctrl input rules, independent palette mutation, physics push/collision, HitDef/Target ownership, pause/superpause allowances, child behavior after parent removal, and broader real-character verification remain future work.

## Special State processing scope

Issue #58's performance/compatibility Phase 1 applies WinMUGEN's entity-specific special-State order:

```text
Root:               State -3 -> State -2 -> State -1 -> Current State
Helper keyctrl = 0: Current State
Helper keyctrl = 1: State -1 -> Current State
```

Normal Helpers never scan State -3 or State -2. A Helper without key control never scans State -1.
With `keyctrl = 1`, the root command set is supplied and State -1 may route the Helper before the
resulting current State executes. Focused tests cover both keyctrl branches and preserve the existing
root ordering. Trigger diagnostics, trigger-group caching, compiled Trigger expressions, and State
lookup changes belong to later Issue #58 phases and are deliberately unchanged here.
