# Common Jump Landing Runtime

WebMUGEN treats MUGEN common jump landing as a runtime physics transition, not as a `common.cmd` command route.

## State meaning

In a state header such as:

```cns
[Statedef 50]
type = A
physics = A
```

`type = A` classifies the player state as airborne. `physics = A` selects air physics. The landing rule should follow `physics = A`, not a hard-coded state number list.

## Landing rule

When a player is in any state with `physics = A`, the physics step applies air gravity. When that motion reaches the ground and `Statedef 52` exists, the runtime transitions to `State 52` with `stateTime = 0` and `animTime = 0`.

```text
if physics = A
and vertical motion reaches the ground
and Statedef 52 exists
then transition to State 52
```

This matches the role of common air physics better than routing `50 -> 51` through `common.cmd`.

## Common jump flow

The baseline common movement flow is:

```text
holdup command
  -> State 40 jump start
  -> State 50 airborne movement through physics = A
  -> fresh Up above airjump.height and within airjump.num enters State 45
  -> State 45 applies airjump.neu/fwd/back velocity and returns to State 50
  -> State 52 jump land when air physics reaches the ground
```

AirJump is root-player special-State behavior, not a hidden KFM route or a replacement State body in
`common.cmd`. The runtime tracks a fresh Up press and the per-jump budget, while the unmodified State
45 CNS remains responsible for animation, direction selection, velocity, and the State 50 return.

`State 51` is not the general landing target. It can exist for compatibility or character-specific air-state routing, but ground contact should not require a `50 -> 51` command route.

## Character override

Character CNS/CMD definitions still take priority. The common route only fills baseline movement behavior when the character does not provide an equivalent route/state.
