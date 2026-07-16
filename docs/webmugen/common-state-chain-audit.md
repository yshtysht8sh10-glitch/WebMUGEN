# Common State 5000–5210 chain audit

Issue #63 is the cross-cutting audit over the focused work in Issues #59–#62. It treats the accepted HitDef, persistent GetHitVar snapshot, common StateDefs, physics, recovery, KO, and RoundState as one pipeline. `public/chars/common1.cns` remains unchanged.

## Audited chain

```text
accepted HitDef
  -> 5000/5001 or 5010/5011 or 5020
  -> 5030/5035/5040/5050 or 5070/5071
  -> 5080/5081 or 5100/5101/5110
  -> 5120 -> State 0
  -> 5150 -> RoundState KO
  -> 5200/5201 or 5210 -> State 52 (fall recovery only)
```

5060 and 5090 are animation families selected by States 5050 and 5080; they are not fabricated StateDefs. 5200, 5201, and 5210 are fall-recovery states, not dead states.

## Cross-cutting invariants

- Accepted contact creates one persistent GetHitVar snapshot. Common State changes do not replace it.
- Hitpause freezes controllers, position, StateTime, AnimTime, and independent hit-stun/fall/down clocks. Processing resumes with no extra frame.
- HitShakeOver follows defender hitpause. HitOver follows the independent selected hit-time clock, not StateTime.
- Ground/air/fall/down velocities and yaccel are read from the snapshot. Facing conversion happens once at contact.
- Ground crossing remains available to common CNS before GroundClamp. Bounce and landing decisions are data-driven.
- `fall.recover` and `fall.recovertime` gate recovery input. `down.hittime` is lying-hit time; `[Data] liedown.time` independently schedules get-up.
- `kill`, `guard.kill`, and `fall.kill` are independent. Lethal normal/guard contact forces the common fall route; nonlethal flags clamp at one Life.
- KO cannot enter State 5120 or fall recovery. It reaches State 5150, remains `ctrl = 0`, rejects later collision/Target registration, and supplies RoundState winner/end reason.
- Round restart constructs fresh player, target, pause, effect, and KO state.

## Bundled real-character audit

The production loader test uses T-H-M-A's real State 215 HitDef and AIR collision data without replacing its parameters. The forced trigger only isolates the existing controller. Five self-contained scenarios cover:

- grounded target, P1 attacker, Facing right;
- airborne target, P2 attacker, Facing left;
- stage-edge target with opposite Facing;
- P1 lethal chain through 5150 and RoundState winner;
- P2 lethal chain through 5150 and RoundState winner.

The normal chains visit 5000/5020, 5035, 5050, 5100, 5110, 5120, and State 0. The lethal chains visit the same fall/down path and terminate in 5150 without 5120. Diagnostics assert accepted collision, `fall=1`, controller transitions, player symmetry, and round result.

The optional three-character harness remains available through `WEBMUGEN_REAL_CHARACTER_DEFS`. Because the third character is an external local asset, the normal repository suite skips those three tests rather than claiming evidence it does not have.

## Matrix audit

Every common StateDef from 5000 through 5210 is represented individually. Issue #63 adds the previously omitted State 5071 row. Animation-only families 5060 and 5090 are explicitly labeled. The canonical HTML and Markdown mirror validate together as 419 rows.

## Confirmation boundary

Focused and full automated tests establish the engine chain. Multiple-character browser play and WinMUGEN comparison remain the user's requested bundled confirmation gate. Issue #63 must remain open until #62 is confirmed/closed and this real-game audit is accepted. Per user instruction, Issue #2 is not updated during this audit.
