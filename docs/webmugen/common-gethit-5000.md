# Common get-hit States 5000-5020

Issue #59 verifies the unmodified `public/chars/common1.cns` entry family through the production HitDef, CNS and physics pipeline.

State 5000 is standing hit shake. Contact stores ground/air/fall animtype codes, reaction type, hit/slide/control times, velocity and fall data independently of live State fields. Its StateDef clears live velocity while keeping the snapshot. Light/Medium/Hard select the High 5000-series or Low 5010-series; Back selects 5030; Up/DiagUp select 5051/5052 only when that AIR action exists and otherwise retain 5030. Real HitShakeOver routes a non-launching hit to 5001 and a launch/fall hit to 5030.

State 5001 is standing slide. Time zero restores snapshotted X hit velocity. AnimTime selects the continuation animation, slidetime begins velocity damping, and HitOver stops velocity, restores defence, then enters State 0 with control. HitOver is based on the independent contact hit-stun clock, not StateTime, and hitpause does not advance it.

State 5010 is the crouching counterpart of 5000. It selects 5020-series Light/Medium/Hard animations, shares Back/Up/DiagUp handling, changes to aerial StateType for launch/fall, and routes to 5011 or 5030 only after HitShakeOver.

State 5011 is crouching slide. It restores X velocity, selects the 5025-series continuation, applies slidetime damping, and enters common crouch State 11 with control only when HitOver is true.

State 5020 is air hit shake and is selected only when the target was airborne at contact. It uses `air.type`, `air.animtype`, `air.hittime`, and air velocity from the contact snapshot, then enters 5030 after HitShakeOver. Ground/crouch contact cannot enter 5020 through the resolver. Guard contact remains isolated in common guard-hit States 150/152/154 and does not contaminate the 5000-family snapshot.

Diagnostics use `raw.gethitvar_snapshot`, `raw.hit_anim_select`, `raw.hit_reaction`, `raw.gethitvar_frame`, `raw.gethit_changestate_eval`, `raw.hitpause`, and `raw.hitstun_tick`. Together they expose entity, State/PrevState/StateTime, Anim/AnimTime, StateDef fields, ctrl, hitpause/hit-stun elapsed and remaining, snapshot identity and anim/type/time/velocity values, HitShakeOver/HitOver, Controller index/source, and the selected transition.
