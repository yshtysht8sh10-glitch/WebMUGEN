# Helper runtime compatibility

Issue #58 Phase1 introduces a real Helper entity collection without replacing the existing P1/P2 adapter. A Helper is not an Explod and is not inserted into `GameState.players`.

Each entry separates its unique runtime `entityId` from the MUGEN `helperId`; duplicate MUGEN IDs are valid. It records `rootEntityId`, `parentEntityId`, character/State/animation ownership, `keyctrl`, `ownpal`, `pausemovetime`, `supermovetime`, spawn frame, and an independent PlayerState containing StateNo, PrevStateNo, StateTime, StateDef fields, position, velocity, Facing, Anim/AnimTime, Size scale, and variable maps. A newly-created Helper starts with sprite priority `0` unless its initial StateDef supplies `sprpriority`; it does not inherit the parent's live priority. Same-priority Helpers are queued behind the older root-player sprites, matching the T-H-M-A State 3900 cut-in. Helper Controller `size.xscale`/`size.yscale` are snapshotted at creation and apply to owner AIR/SFF rendering and the Helper's Size-derived collision geometry.

The Phase1 frame order is:

1. evaluate the two root players and the Helper snapshot that existed at frame start;
2. collect Helper and DestroySelf requests without mutating the collection;
3. remove destroyed entities and append spawned entities with monotonic runtime IDs;
4. skip State/physics stepping for newly spawned entities in that frame;
5. render a new Helper immediately only when its initial StateDef presentation is already stable; defer Helpers with presentation-changing controllers;
6. begin the normal owner-CNS State pass on the next frame, then render every surviving Helper through owner-scoped AIR/SFF assets.

State execution remains deferred, but visibility is conditional. A Helper whose initial State has
`ChangeAnim`, `AngleDraw`, position, palette, Facing, priority, or other presentation controllers is
hidden until those controllers receive their first pass. Bundled itoko Helper 1210 therefore still
first appears as its strong red belt with the evaluated transform instead of flashing one unscaled
green frame. A Helper whose StateDef already determines the complete initial presentation may draw
on its creation frame; itoko flying-hand Helper 1421 uses this path so the rocket punch has no blank
frame between the attached hand and the launched hand.

Issue #81 adds Helper-as-attacker collision after the root-player clash pass. A Helper with an active HitDef resolves its owner AIR `Clsn1` against root `Clsn2` boxes allowed by `affectteam` E/F/B (enemy by default); accepted contact updates the Helper's HitPause, MoveContact/MoveHit, consumed-target history, and Target registry while applying damage, reaction State/velocity, guard handling, and HitDef effects to the root target. Helper-owned Target controllers commit against that root target, and later controllers in the same Helper State pass observe the queued mutation through `target(ID)` redirects. This supports the bundled T-H-M-A sequence where Helper 3725 applies TargetState 3738, observes it, enters 3735, and lets the root's `helper(3725),StateNo` redirect enter 3730 on the next pass. Helper TargetBind ownership uses the unique runtime entity id, so the target follows Helper 3725 after physics instead of following its root. Hit events retain the root character id for owner AIR/SFF/SND effect lookup, while `raw.helper_hit_collision` identifies the unique Helper runtime id. T-H-M-A State 3320 and State 3735 provide production regression coverage.

`NumHelper` reads Helpers visible to the current root and optionally filters by MUGEN ID. A Helper queued earlier in the same tick is immediately included in later `NumHelper` checks, while its own State execution still begins on the next frame; a queued `DestroySelf` is excluded from later counts. This ordering is required when itoko's three broken bags enter State 1105 together: the first allocates H1105, the second observes it and allocates H1106, and the third allocates H1107 instead of all three producing an overlapping H1105. Bare `IsHelper` distinguishes a Helper evaluation context from a root player, while `IsHelper(expr)` compares the evaluated integer with that entity's MUGEN Helper ID. The ID is carried on the Helper's PlayerState so redirect evaluation preserves the distinction. Itoko's H1101 bag route also compares the `var(9)` values of optional H1101/H1102/H1103 siblings: direct missing-Helper operands remain SFalse for equality but contribute zero to numeric ordering, allowing the surviving bag to enter 1103, then 1104/1105, and spawn the button Helper. `DestroySelf` only removes the executing Helper; it does not destroy a root player. `raw.helper` reports spawn/destroy identity, ownership, State, Anim, frame, and first-step timing. Round restart creates an empty collection and resets the runtime allocator.

Explods created by a Helper retain that Helper's unique runtime entity ID. `NumExplod`, `ModifyExplod`, `RemoveExplod`, and `ExplodBindTime` therefore operate on the executing Helper's entries without matching same-ID root or sibling entries. A `postype = p1` bind follows the Helper entity rather than its root. This permits real Helper cleanup routes such as T-H-M-A's persistent gauge Explods followed by `RemoveExplod` and `DestroySelf`; Helper destruction itself still does not implicitly choose an Explod cleanup policy.

Helper creation resolves P1/P2 directly in stage space. `front/back/left/right` resolve X against the current logical viewport, retain WinMUGEN Helper's P1-axis-relative Y, and then add the current camera origin once to store a world position. This differs from Explod, whose four screen-edge postypes use viewport-top Y. T-H-M-A State 3900 covers the reversed P1/P2 `back` route at 400x240.

A normal Helper starts unbound and excluded from camera movement (`ScreenBound value = 0`, `movecamera = 0,0`). Its own tick-scoped ScreenBound can opt into horizontal and/or vertical camera following without enabling screen containment. This is the camera-manipulation route used by T-H-M-A Helper 3725.

During match Pause or SuperPause, a non-owner Helper may continue its CNS, physics, animation history, and State/Anim clocks while the matching `pausemovetime` or `supermovetime` allowance remains. The active allowance is consumed once per paused game frame; normal Pause never consumes the SuperPause allowance and vice versa. The match pause owner's ordinary `movetime` remains a separate permission path.

Helper support remains Partial. Root/parent/helper/playerid redirects resolve unique runtime entities. BindToParent/Root and registered-target BindToTarget retain evaluated position/facing state, while ParentVarSet/Add mutate the unique immediate parent's validated var/fvar store at the entity commit point. Remaining work includes exact bind/ParentVar same-pass pause timing, complete keyctrl input rules, independent palette mutation, Helper push/body interaction, Helper-as-defender and Helper-vs-Helper combat, exact Helper/root Power ownership, child behavior after parent removal, and the general owner-removal policy for effects that were not explicitly removed.

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
