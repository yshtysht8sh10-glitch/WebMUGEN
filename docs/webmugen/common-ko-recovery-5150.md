# Common KO and fall-recovery states (5150/5200/5201/5210)

Issue #62 connects the common KO route to the existing hit, fall, down, and round pipelines without changing `public/chars/common1.cns`.

## Correct state roles

- State 5150 is the lying-dead KO state. State 5110 enters it only when `Life <= 0`; its StateDef keeps `ctrl = 0`, selects the 5140 family when available, switches to the 5150 family after `MatchOver`, and falls back to Anim 5110 when the character has no lying-dead animation.
- State 5200 is airborne fall recovery while the player is still falling. It accelerates with `GetHitVar(yaccel)` and enters 5201 near the ground.
- State 5201 is the ground-assisted fall-recovery launch. It applies the common recovery animation, position, velocity, and one-tick recovery immunity.
- State 5210 is airborne fall recovery. `PosFreeze` suppresses movement on the controller execution frame, then the common CNS applies recovery steering, gravity, timed immunity/control, and State 52 landing.

There is no valid 5150-to-5200/5210 recovery route in WinMUGEN common state data. Recovery input while KO remains in 5150. The original Issue labels for 5200 and 5210 as lying-dead states were corrected during implementation rather than reproduced as a state-number-specific engine rule.

## KO ownership and timing

Normal `kill`, guarded `guard.kill`, and fall `fall.kill` independently decide whether their applicable damage may reduce Life to zero. A disabled flag clamps Life to one. A successful lethal hit records `koReason=hit`, guarded chip records `koReason=guard`, and lethal `HitFallDamage` records `koReason=fall` only when that controller actually crosses Life from positive to zero.

A lethal normal or guarded contact sets the get-hit fall flag. A guarded KO leaves the contact classified as guarded for MoveGuarded/effects but enters the normal ground/crouch/air get-hit reaction instead of returning through States 150-155. Both cases then use the unmodified common 5000/5030/5100/5110 route into 5150; the engine does not jump directly to a numbered dead state.

Hit pause remains authoritative. CNS state controllers and physics do not advance while the defender counter is positive, so the State 5110-to-5150 route executes only after hit pause reaches zero. An already-KO player is rejected before new hit eligibility and is pruned from registered Target selection. State 5150's `NotHitBy` remains active as the data-defined exclusion layer.

## Round integration

The app passes the current round phase, round number, winner, match-over flag, and end reason into the CNS trigger context. `MatchOver`, `Win`, `Lose`, and `DrawGame` read that context. RoundState distinguishes `ko`, `double_ko`, and `time_over`; simultaneous KO produces a draw without being confused with timer expiry. Round restart constructs fresh players and therefore clears KO reason, dead state, hit/target state, and control suppression.

## Diagnostics

Common get-hit diagnostics cover States 5150, 5200, 5201, and 5210. The frame record includes Life/KO status, KO reason, the three kill flags, lying-dead status, round phase, winner, match-over request, and round-end reason. Existing controller trace lines provide State/Anim before and after, StateTime, controller index, and ChangeState source.

## Verification boundary

Focused tests cover lethal/nonlethal hit, guard and fall flags, the complete grounded lethal common route, hit-pause ordering, P1/P2 KO, simultaneous KO versus time over, State 5150 animation/fallback/lockout, both recovery paths, `PosFreeze`, KO collision exclusion, fall landing shake, and round reset. Browser real-game comparison remains a user confirmation item before Issue #62 is closed.
