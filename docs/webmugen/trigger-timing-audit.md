# Trigger timing audit

This audit records the production ordering used by time-dependent WinMUGEN triggers. It is evidence for Issue #89; it does not promote the remaining Partial compatibility boundaries to Complete.

## Clock table

| Trigger | Value sampled by CNS | HitPause | Pause / SuperPause | Resume boundary |
| --- | --- | --- | --- | --- |
| `Time`, `StateTime` | current entity `stateTime` before this tick's physics | frozen; readable only from an `ignorehitpause` Controller | frozen for non-owners; the exact root or Helper owner advances while `movetime` remains | one resume-guard pass suppresses Controllers, then physics advances without replaying activation side effects |
| `AnimTime` | MUGEN AIR end-time calculation at current `animTime` | frozen | same entity ownership rule as StateTime | finite actions reach 0; LoopStart and infinite elements retain their documented nonzero behavior |
| `GameTime` | monotonic `GameState.frame` | continues | continues | never rewound by the resume guard |
| `HitPauseTime` | remaining entity hit-pause counter before physics decrements it | ordinary Controllers are suppressed; `ignorehitpause` can observe it | independent from match Pause | zero resumes without an added frozen tick |
| `MoveContact`, `MoveHit`, `MoveGuarded` | owner-local contact age, starting at 1 | frozen with owner hitpause | frozen when owner physics is gated; advances only for the exact entity allowed to move | first active physics tick after the guard advances the age |
| `ProjContactTime`, `ProjHitTime`, `ProjGuardedTime`, `ProjCancelTime` | owner-local projectile history, 1 on activation and -1 when absent | frozen with owner hitpause | projectile simulation is frozen during global Pause/SuperPause; stored history is not aged | resumes on the next active projectile/owner tick |

## Entity ownership

Pause ownership uses the unique runtime entity id, not the character root id or the duplicate-capable MUGEN Helper id. A root-owned pause allowance advances that root only. A Helper-owned allowance advances that Helper's Controllers, StateTime, AnimTime, position, velocity, and AfterImage while both roots and other Helpers stay frozen. Explods consume their own `pausemovetime` or `supermovetime` allowance. Runtime Projectiles currently freeze globally and do not have an independent per-projectile movement allowance.

## Ordering and diagnostics

The activation CNS pass emits Pause/SuperPause and other Controller side effects once. Later globally paused passes log `global_pause skip` with kind, remaining time, and owner. HitPause logs selective execution and remaining time. Explod diagnostics record frozen/allowed updates and allowance consumption. `resumeGuard` makes the first post-pause pass advance clocks without re-running the activation Controller at the same StateTime.

P1 is evaluated before P2, and Helpers after both roots. Same-pass events produced before a newly emitted Pause is committed remain an explicit Partial boundary. Exact comparison against WinMUGEN for simultaneous player events and Helper-owned Projectile pause behavior remains a manual compatibility check, not an untracked fallback.
