# WinMUGEN Round Flow

WebMUGEN drives round presentation through character CNS states instead of a fixed browser-only intro timer.

## RoundState and state families

| RoundState | Runtime phase | Character entry |
| --- | --- | --- |
| 0 | PreIntro activation pass | both roots enter State 190 |
| 1 | Intro synchronization | character CNS owns States 190-199; the match waits while either root remains in that family or asserts `intro` |
| 2 | Fight | normal commands, collision, projectiles and timer are enabled |
| 3 | Round over | winner enters State 180, loser State 170, or both enter State 175 for a draw |
| 4 | Match over | the same result states continue after either player reaches two round wins |

State 190 is the common PreIntro dispatcher and normally enters 191. States 191-199 are character-owned intro branches. State 180 is the win dispatcher; character CNS may select 181-189. State 170 is the lose dispatcher; character CNS may select 171-174. State 175 is the common draw entry and may fall back to 170 when Action 175 is absent.

## Ordering

The Round Flow coordinator changes only the root state and ownership envelope. The ordinary CNS runtime applies the destination StateDef header and executes its Controllers, so animation, sound, `AssertSpecial`, and character-specific branches remain data-driven. No character name or State-specific TypeScript branch is used beyond the standard WinMUGEN entry families.

During PreIntro/Intro and round-over presentation, CNS and animation/physics clocks run, but command input and hit/projectile collision are disabled. Fight begins only after both roots have left States 190-199 and neither asserts `intro`, so different intro lengths synchronize on the longer character. Pause/SuperPause continues to gate the same entity clocks.

After 180 result frames, a non-final round restarts at the next RoundNo and re-enters State 190. Two wins mark match over and expose RoundState 4; automatic Continue/select-screen navigation is outside the current single-match browser runtime and remains an explicit product boundary.
