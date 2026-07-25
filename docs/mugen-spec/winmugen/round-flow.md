# WinMUGEN Round Flow

WebMUGEN drives round presentation through character CNS states instead of a fixed browser-only intro timer.

## RoundState and state families

| RoundState | Runtime phase | Character entry |
| --- | --- | --- |
| 0 | Initialize / PreIntro activation pass | both roots enter State 5900; first-round character/common CNS routes through State 190 |
| 1 | Intro synchronization | character CNS owns States 190-199; the match waits while either root remains in that family or asserts `intro` |
| 2 | Fight | normal commands, collision, projectiles and timer are enabled |
| 3 | Pre-over | winner enters State 180, loser State 170, or both enter State 175 for a draw |
| 4 | Over | the result states continue; `MatchOver` separately reports whether the match series is finished |

State 5900 is the engine-owned round initializer. It runs before presentation so character variables and other round-local data are initialized through CNS. On the first round, the standard common route continues to State 190 and then State 191. On later rounds, a character that does not select another intro leaves initialization for State 0 when Fight begins. States 191-199 are character-owned intro branches. State 180 is the win dispatcher; character CNS may select 181-189. State 170 is the lose dispatcher; character CNS may select 171-174. State 175 is the common draw entry and may fall back to 170 when Action 175 is absent.

## Ordering

The Round Flow coordinator changes only the root state and ownership envelope. The ordinary CNS runtime applies the destination StateDef header and executes its Controllers, so animation, sound, `AssertSpecial`, and character-specific branches remain data-driven. No character name or State-specific TypeScript branch is used beyond the standard WinMUGEN entry families.

During PreIntro/Intro and round-over presentation, CNS and animation/physics clocks run, but command input and hit/projectile collision are disabled. After both roots have left States 190-199 and neither asserts `intro`, the HUD presents `ROUND N` and then `FIGHT!`; only after that presentation does RoundState 2 begin. Different intro lengths therefore synchronize on the longer character without covering the character-owned Intro with the round announcement. Pause/SuperPause continues to gate the same entity clocks.

After 180 result frames, a non-final round restarts at the next RoundNo and re-enters State 5900. Result presentation advances from RoundState 3 to RoundState 4 independently of the separate `MatchOver` trigger. Two wins mark the match series over; automatic Continue/select-screen navigation is outside the current single-match browser runtime and remains an explicit product boundary.
