# Helper runtime compatibility

Issue #58 Phase1 introduces a real Helper entity collection without replacing the existing P1/P2 adapter. A Helper is not an Explod and is not inserted into `GameState.players`.

Each entry separates its unique runtime `entityId` from the MUGEN `helperId`; duplicate MUGEN IDs are valid. It records `rootEntityId`, `parentEntityId`, character/State/animation ownership, `keyctrl`, `ownpal`, `pausemovetime`, `supermovetime`, spawn frame, and an independent PlayerState containing StateNo, PrevStateNo, StateTime, StateDef fields, position, velocity, Facing, Anim/AnimTime, Size scale, and variable maps. Helper Controller `size.xscale`/`size.yscale` are snapshotted at creation and apply to owner AIR/SFF rendering and the Helper's Size-derived collision geometry.

The Phase1 frame order is:

1. evaluate the two root players and the Helper snapshot that existed at frame start;
2. collect Helper and DestroySelf requests without mutating the collection;
3. remove destroyed entities and append spawned entities with monotonic runtime IDs;
4. skip State/physics stepping for newly spawned entities in that frame;
5. begin their normal owner-CNS State pass on the next frame;
6. include surviving Helpers in owner-scoped AIR/SFF rendering.

Issue #81 adds Helper-as-attacker collision after the root-player clash pass. A Helper with an active HitDef resolves its owner AIR `Clsn1` against the opposing root player's `Clsn2`; accepted contact updates the Helper's HitPause, MoveContact/MoveHit, consumed-target history, and Target registry while applying damage, reaction State/velocity, guard handling, and HitDef effects to the root target. Hit events retain the root character id for owner AIR/SFF/SND effect lookup, while `raw.helper_hit_collision` identifies the unique Helper runtime id. T-H-M-A State 3320 and Action 3320 provide production regression coverage.

`NumHelper` reads the committed frame-start collection for the current root, with optional MUGEN ID filtering. `IsHelper` distinguishes a Helper evaluation context from a root player. `DestroySelf` only removes the executing Helper; it does not destroy a root player. `raw.helper` reports spawn/destroy identity, ownership, State, Anim, frame, and first-step timing. Round restart creates an empty collection and resets the runtime allocator.

During match Pause or SuperPause, a non-owner Helper may continue its CNS, physics, animation history, and State/Anim clocks while the matching `pausemovetime` or `supermovetime` allowance remains. The active allowance is consumed once per paused game frame; normal Pause never consumes the SuperPause allowance and vice versa. The match pause owner's ordinary `movetime` remains a separate permission path.

Helper support remains Partial. Root/parent/helper/playerid redirects resolve unique runtime entities. BindToParent/Root and registered-target BindToTarget retain evaluated position/facing state, while ParentVarSet/Add mutate the unique immediate parent's validated var/fvar store at the entity commit point. Remaining work includes exact bind/ParentVar same-pass pause timing, complete keyctrl input rules, independent palette mutation, Helper push/body interaction, Helper-as-defender and Helper-vs-Helper combat, exact Helper/root Power ownership, and child behavior after parent removal.

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
