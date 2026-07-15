# Common Fall States 5030-5071

Issue #60 audits the WinMUGEN common fall path without modifying `public/chars/common1.cns`.

## State roles

- 5030 restores HitDef velocity and applies `GetHitVar(yaccel)` while choosing fall or non-fall routing.
- 5035 is the optional upward transition animation and continues the same gravity and route selection.
- 5040 is non-fall air recovery. HitOver grants control and changes MoveType before landing through State 52.
- 5050 owns falling, the 5050/5060 rising/descending animation pair, recovery input/window checks, and ground contact into State 5100.
- 5060 is not a StateDef in the WinMUGEN common file. It is the descending animation family selected by State 5050.
- 5070 freezes the trip animation until HitShakeOver. State 5071 restores hit velocity, applies yaccel, and routes a downward ground crossing to State 5110.

## Timing and contact

Hitpause and match Pause/SuperPause skip CNS controllers and freeze StateTime, AnimTime, position, and velocity. The HitDef snapshot and recovery clock remain independent: fall recovery requires both `fall.recover`, elapsed `fall.recovertime`, and the `recovery` command. Air get-hit states retain an unclamped ground crossing so their own `Pos Y` and `Vel Y` controllers decide the destination.

The focused integration suite covers fall/non-fall branches, 5060 animation selection, trip hitpause, gravity, recovery gating, ground crossing, bounce/down routing, and common-state terminal execution. Down, recovery destination, and KO State details remain owned by their separate roadmap rows.
