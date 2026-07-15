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
