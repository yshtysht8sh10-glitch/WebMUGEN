# WinMUGEN Trigger Audit (Issue #82)

Updated: 2026-07-22

This is the reproducible audit report for GitHub Issue #82. The canonical
checklist is `winmugen-compatibility-matrix.html`; the Markdown Matrix is its
mirror. Per-trigger fields and bundled-character occurrences are stored in
`winmugen-trigger-inventory.json`.

## Scope and references

The WinMUGEN baseline is Elecbyte's official 2002.04.14 Trigger Index. The
derived inventory expands axis forms and Win/Lose suffix forms into separate
Matrix rows. MUGEN 1.0, MUGEN 1.1, WebMUGEN compatibility helpers, and names
seen in later documentation are retained only as explicitly versioned rows.
They are not silently counted as WinMUGEN features.

- WinMUGEN 2002.04.14 Trigger Reference mirror:
  `https://bluesura.github.io/MUGEN/document/Official/2002.04.14/trigger.html`
- Elecbyte MUGEN 1.0 Trigger Reference:
  `https://www.elecbyte.com/mugendocs/trigger.html`
- Elecbyte MUGEN 1.1 Trigger Reference:
  `https://www.elecbyte.com/mugendocs-11b1/trigger.html`

The mirror preserves Elecbyte's versioned document; the inventory is derived
metadata rather than a copied reference document.

## Evaluation pipeline

The production path is not the small `TriggerParser` AST prototype.

```text
CNS/CMD text
  -> CnsParser recognizes triggerall / triggerN keys
  -> complete expression string is retained in CnsTrigger
  -> character/common documents are merged
  -> CharacterLoader prepares compiled trigger closures
  -> CnsStateRuntime builds CnsRuntimeTriggerContext
  -> triggerall AND + numbered triggerN OR groups are evaluated
  -> redirect resolver selects enemy/enemynear/target subset
  -> CnsRuntimeTrigger reads PlayerState / AIR / command / round / target data
  -> comparison converts number/string/enum/bottom-like failure to controller decision
```

Important consequences:

- Production parser syntax support and runtime value support are separate.
- Trigger names are case-insensitive in the evaluator. Command names remain
  case-sensitive strings as specified by Elecbyte.
- Unknown names are still retained by `CnsParser`; without a number/string/
  boolean source their compiled expression evaluates false. These are
  classified `Parser only`, not `Complete`.
- `enemy`, `enemynear`, and `target(id)` have real subset resolvers. `root` and
  `parent` still contain compatibility fallback behavior. `helper`, `partner`,
  and `playerid` are not production-resolved.
- Elecbyte documents recursive redirect as unsupported for this version. The
  audit therefore requires safe SFalse-style failure, not invented recursion.

## Parser audit

`CnsParser` stores the complete right-hand side of every `triggerall` and
`triggerN` record. The compiled evaluator currently supports the documented
subsets of:

- case-insensitive Trigger names and enum comparisons;
- quoted `Command = "name"` and other string comparisons;
- `var(...)`, `fvar(...)`, `sysvar(...)`, `const(...)`, `gethitvar(...)`;
- old-style axis forms such as `Pos X`, `Vel Y`, and `P2Dist X`;
- comparisons, inclusive/exclusive intervals, boolean operators, arithmetic,
  parentheses, negative numbers, decimals, and selected math functions;
- trigger grouping (`triggerall` AND, repeated records within one group AND,
  distinct numbered groups OR);
- the current redirect subset and SFalse-style missing-target behavior.

The standalone `src/parser/cns/TriggerParser.ts` recognizes only a small AST
identifier set and is not the production CNS controller path. Its existence is
not counted as support for the full Trigger inventory.

## Audit result

The inventory contains 158 Matrix rows:

- 122 WinMUGEN rows after axis/suffix expansion;
- 36 explicitly versioned later-version, compatibility-extension, or
  pseudo-trigger rows.

Classification counts:

| Issue #82 classification | Count | Meaning in this audit |
|---|---:|---|
| Not implemented | 0 | No row is placed here because the production parser retains every expression; runtime-missing names are Parser only. |
| Parser only | 24 | Expression retained, but no correct evaluator/runtime source. |
| Safe fallback | 12 | Fixed/default value prevents a crash but is not WinMUGEN semantics. |
| Partial | 89 | A real path exists, but arguments, entity ownership, redirect, pause timing, or evidence is incomplete. |
| Complete | 7 | Conservative scope with focused and real-character/runtime evidence. |
| Not applicable | 26 | Later MUGEN version, WebMUGEN helper, or pseudo-trigger syntax outside WinMUGEN. |

### Complete

`AnimElem`, `AnimElemTime`, `Command`, `Ctrl`, `StateNo`, `StateType`, `Time`.

### Parser only

`ID`, `IsHomeTeam`, `LoseKO`, `LoseTime`, `MatchNo`, `MoveReversed`, `P1Name`,
`P3Name`, `P4Name`, `PalNo`, `ParentDist X`, `ParentDist Y`, `PlayerIDExist`,
`ProjContact`, `ProjGuarded`, `ProjHit`, `RootDist X`, `RootDist Y`, `SysFVar`,
`TeamMode`, `UniqHitCount`, `WinKO`, `WinPerfect`, `WinTime`.

### Safe fallback

`LifeMax`, `NumEnemy`, `NumExplod`, `NumPartner`, `NumProj`, `NumProjID`,
`ProjCancelTime`, `ProjContactTime`, `ProjGuardedTime`, `ProjHitTime`, `Random`,
`RoundsExisted`.

### Partial

`Abs`, `ACos`, `Alive`, `Anim`, `AnimElemNo`, `AnimExist`, `AnimTime`, `ASin`,
`ATan`, `AuthorName`, `BackEdgeBodyDist`, `BackEdgeDist`, `BodyDist X`,
`BodyDist Y`, `CanRecover`, `Ceil`, `Const`, `Cos`, `DrawGame`, `E`, `Exp`,
`Facing`, `Floor`, `FrontEdgeBodyDist`, `FrontEdgeDist`, `FVar`, `GameTime`,
`GetHitVar`, `HitCount`, `HitDefAttr`, `HitFall`, `HitOver`, `HitPauseTime`,
`HitShakeOver`, `HitVel X`, `HitVel Y`, `IfElse`, `InGuardDist`, `IsHelper`,
`Life`, `Ln`, `Log`, `Lose`, `MatchOver`, `MoveContact`, `MoveGuarded`,
`MoveHit`, `MoveType`, `Name`, `NumCommand`, `NumHelper`, `NumTarget`,
`P2AuthorName`, `P2BodyDist X`, `P2BodyDist Y`, `P2Ctrl`, `P2Dist X`,
`P2Dist Y`, `P2Facing`, `P2Life`, `P2MoveType`, `P2Name`, `P2StateNo`,
`P2StateType`, `Physics`, `Pi`, `Pos X`, `Pos Y`, `Power`, `PowerMax`,
`PrevStateNo`, `RoundNo`, `RoundState`, `ScreenPos X`, `ScreenPos Y`,
`SelfAnimExist`, `Sin`, `StateTime`, `SysVar`, `Tan`, `TargetID`,
`TargetStateNo`, `TeamSide`, `TicksPerSecond`, `TimeMod`, `Var`, `Vel X`,
`Vel Y`, `Win`.

### Not applicable to WinMUGEN scope

`AILevel`, `BackEdge`, `BottomEdge`, `CameraPos X`, `CameraPos Y`,
`CameraZoom`, `Cond`, `Const240p`, `Const480p`, `Const720p`, `FrontEdge`,
`GameHeight`, `GameWidth`, `LeftEdge`, `RightEdge`, `ScreenHeight`,
`ScreenWidth`, `TargetDist X`, `TargetDist Y`, `TargetLife`, `TargetVel X`,
`TargetVel Y`, `Timeremaining`, `TopEdge`, `WinHyper`, `WinSpecial`.

`TargetLife`, `TargetVel`, and similar names are tracked here because the parent
Issue named them, but WinMUGEN expresses these through a `target(id), ...`
redirect followed by `Life`, `Vel`, `StateNo`, or another ordinary Trigger.

## Bundled-character evidence

`npm run trigger:audit -- --write` scans bundled CNS/CMD/ST files (excluding the
unchanged compatibility asset `public/chars/common1.cns`) and stores file,
count, and first-line evidence on each record. High-frequency families include
`Time`, `AnimElem`, `Var`, `StateNo`, `Command`, `StateType`, `Anim`,
`MoveContact`, `AnimTime`, and `MoveHit`. Presence is usage evidence only; it
never promotes a fallback or incomplete runtime path to Complete.

## Reproducible audit and registration gate

Run:

```text
npm run trigger:audit
npm run matrix:check
npm test -- --run scripts/winmugen-trigger-inventory.test.mjs
```

The audit fails when:

- an inventory Trigger is absent from the Matrix;
- a Matrix Trigger is absent from the inventory;
- the six-way classification differs;
- a directly dispatched evaluator case is not inventoried.

Use `npm run trigger:audit -- --write` to regenerate bundled-character usage,
the JSON inventory, and the two Matrix Trigger sections after an intentional
inventory change.

## Prioritized roadmap

1. Projectile fixed fallbacks and missing contact triggers: #86.
2. Root/Parent/Helper/PlayerID redirects and entity identity: #84.
3. HitPause/Pause/SuperPause timing across time-dependent triggers: #89.
4. Round/Match/Win/Team fixed values and missing suffixes: #87.
5. Position/distance/camera/body-edge approximations: #83.
6. Target redirect coverage beyond the two-root-player subset: #85.
7. Variable/math/metadata correctness, especially Random and SysFVar: #88.
8. State/animation ownership and remaining AIR timing paths: #90.

These child Issues keep the parent audit complete without pretending that all
Trigger runtime behavior is complete.
