# Power Infinite setting

Issue #64 adds a WebMUGEN runtime convenience setting. It is not a WinMUGEN CNS compatibility feature and does not change the compatibility status of `Power`, `PowerMax`, `PowerAdd`, `PowerSet`, StateDef `poweradd`, or HitDef power transfer.

## Modes and persistence

Runtime Settings exposes `OFF`, `P1`, `P2`, and `P1 + P2`. The first-run and invalid-value fallback is `OFF`. The selected value is stored with the other runtime settings under `webmugen.runtimeSettings.v1`; older stored values that do not contain the field remain `OFF`.

The setting targets the two root players only. Helper power ownership is outside this phase. Changing tabs does not recreate the runtime or alter the selected mode. Character reload and round reset retain the setting, while the newly created root-player gauges are normalized on the next frame boundary.

## Frame ordering

At the start of each game frame, after the runtime frame number is synchronized and before any negative or current State controller is evaluated, a selected root player's real `power` is set to its real `powerMax`. No sentinel or oversized fixed value is used.

All CNS behavior within that frame remains ordinary and ordered:

1. the frame starts with `power = powerMax` for selected players;
2. StateDef `poweradd`, `PowerAdd`, `PowerSet`, HitDef power transfer, and power triggers evaluate in their normal controller order;
3. a later trigger in the same frame observes the value produced by earlier controllers;
4. the gauge is replenished only at the start of the following game frame.

Switching to `OFF` clears the infinite marker but does not rewrite the current gauge. Ordinary controllers and hits resume from the current real value. Pause and tab display changes do not introduce an extra replenishment pass; replenishment follows the existing game-frame loop.

## Diagnostics and HUD

`raw.power_infinite` records mode changes and actual frame-start replenishment with entity, before/after values, `powerMax`, and `timing=frame_start`. The normal `raw.power` controller/StateDef/HitDef diagnostics remain authoritative for mutations later in the frame.

The Canvas power bar remains a normal `power / powerMax` bar and displays `∞` beside each selected root player's gauge. `raw.power_hud` includes `infinite=off|p1|p2|both`, allowing a copied runtime log to prove the active setting without relying on the visual marker alone.
