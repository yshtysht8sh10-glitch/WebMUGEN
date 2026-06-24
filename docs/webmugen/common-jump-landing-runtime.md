# Common Jump Landing Runtime

WebMUGEN treats MUGEN common jump landing as a runtime physics transition, not as a `common.cmd` command route.

## State meaning

In `common1.cns`, a state header such as:

```cns
[Statedef 50]
type = A
physics = A
```

means the player is in an airborne state and should receive air physics. It does not mean the state must contain an explicit `ChangeState` controller to leave the air.

## Common jump flow

The baseline common movement flow is:

```text
holdup command
  -> State 40 jump start
  -> State 50 jump up / airborne
  -> State 52 jump land when air physics reaches the ground
```

`State 51` is not the normal landing target. In WinMUGEN/common CNS material it is commonly an empty or compatibility jump-down state. The visible landing behavior should go through `State 52` when that state exists.

## Implementation rule

`public/chars/common.cmd` owns baseline input routes such as `holdup -> 40` and `40 -> 50`.

The CNS runtime owns the ground-contact rule:

```text
if stateNo is 40, 50, or 51
and air physics reaches ground
and Statedef 52 exists
then transition to State 52 with stateTime=0 and animTime=0
```

This keeps command routing separate from physics landing behavior and avoids adding incorrect `50 -> 51` command-state routes.

## Character override

Character CNS/CMD definitions still take priority. The common route only fills baseline movement behavior when the character does not provide an equivalent route/state.
