# Common Down States 5080-5120

Issue #61 audits the WinMUGEN common down and get-up path without modifying `public/chars/common1.cns`.

## State roles

- 5080 is lying-hit shake. It selects Anim 5080 for zero down Y velocity or Anim 5090 for a launch, then enters 5081 or 5030 when hit shake ends.
- 5090 is an animation number, not a StateDef.
- 5081 is the zero-Y lying-hit slide and enters 5110 after `down.hittime` expires through HitOver.
- 5100 is first fall contact. It handles landing animation, fall damage, velocity reduction, and no-bounce versus 5101.
- 5101 applies HitFallVel and acceleration for the optional single bounce, then enters 5110 on its next ground crossing.
- 5110 is liedown. It owns landing animation/friction and KO routing; the engine schedules a living player's get-up from `[Data] liedown.time`.
- 5120 is get-up. It plays the character animation, applies two timed NotHitBy slots, executes HitFallSet, and returns to State 0 with control only when the animation completes.

## Independent timers

`down.hittime` applies only to a HitDef that contacts a lying target with zero `down.velocity.y`. Get-up uses a separate `lieDownElapsed` counter and the defender's `data.liedown.time`. Neither clock advances during hitpause or match pause, and a player with zero Life is never automatically sent to 5120.

## Diagnostics and tests

`raw.gethitvar_frame`, `raw.gethit_changestate_eval`, `raw.fall_pause`, and `raw.down_clock` expose state/animation, position/velocity, contact crossing, down and lie timers, Life/KO, controller index, and pause decisions. Focused tests cover P1/P2 down hits, 5080/5090 selection, default and explicit down velocity, down.bounce, 5100/5101, liedown timing, hitpause, KO hold, 5120 immunity slots, and State 0 control return.
