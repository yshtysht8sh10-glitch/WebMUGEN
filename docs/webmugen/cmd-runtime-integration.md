# CMD Runtime Integration Notes

This document records the current WebMUGEN CMD command path. Keep it current: CMD bugs are easy to misdiagnose because parser, input history, command matching, buttons, and CNS triggers are separate layers.

## Current Runtime Status

WebMUGEN now supports this path:

```text
Character .cmd file
  -> CharacterLoader
  -> parseCmdText(...)
  -> CharacterAssets.cmd
  -> stepGameByCns(..., cmdDocument)
  -> GameState.commandBuffers[p1/p2]
  -> input/CommandResolver.resolveCommands(...)
  -> GameState.commandNames[p1/p2]
  -> PlayerInput.commandNames
  -> CNS trigger: command = "..."
  -> controller execution / ChangeState
```

This means a command defined in `.cmd` can drive a CNS trigger across multiple frames, for example:

```ini
[Command]
name = "QCF_x"
command = ~D, DF, F, x
time = 20
```

can drive:

```ini
[State 0, Special]
type = ChangeState
trigger1 = command = "QCF_x"
value = 300
```

The integration test `src/core/engine/CmdIntegration.test.ts` covers this buffered transition.

## Runtime State

`GameState` can carry command runtime data after `stepGameByCns()` has run:

```ts
commandBuffers?: [InputBuffer, InputBuffer];
commandNames?: [ReadonlySet<string>, ReadonlySet<string>];
```

`createInitialGameState()` does not need to eagerly allocate these fields. `stepGameByCns()` initializes them when missing.

`commandBuffers` preserve per-player input history across calls to `stepGameByCns()`. This is required for multi-step commands such as quarter-circle motions.

`commandNames` expose the current frame's matched command names for debug overlays and future runtime tracing.

## Buttons

`PlayerInput` now supports explicit MUGEN-style button names:

```ts
buttons?: ReadonlySet<string> | readonly string[];
```

`attack: true` is retained for compatibility and maps to button `a`.

Explicit `buttons` are merged into the frame button set and lower-cased. This allows KFM-style commands such as:

```ini
command = ~D, DF, F, x
command = x+y
command = /$D,a
```

Browser input helpers map keys to MUGEN buttons:

```text
P1: A/S/D -> a/b/c, Q/W/E -> x/y/z
P2: F/G/H -> a/b/c, U/O/P -> x/y/z
```

If the UI constructs `PlayerInput` manually, it must set `buttons` for non-`a` buttons. Without that, commands such as `QCF_x` cannot match.

## CMD-Derived Control Help

Static help text such as:

```text
P1: ← / → 移動, ↑ ジャンプ, A 攻撃
```

should be replaced by CMD-derived help where possible.

Use:

```ts
formatCmdControlHelp(character.cmd)
```

from `src/app/CmdControlHelp.ts` to generate display lines from the loaded `.cmd` file.

Example output:

```text
QCF_x: ↓, ↓→, →, x
FF: →, →
down_a: ↓, a
```

This avoids hard-coding controls that do not match the current character. The UI may still show a short key-map legend separately, but move/command help should come from CMD.

## CMD Modifiers

The live matcher under `src/input/CommandMatcher.ts` handles common MUGEN modifiers:

```text
~D    release hint; parsed as D for now
/$D   hold D
$F    hold F
x+y   simultaneous buttons
```

Release timing is not fully modeled yet; `~` is currently stripped so KFM commands can match. Full release-edge semantics can be added later without changing the current command path.

## Important Implementation Details

### Input history is internal to `stepGameByCns()`

The app layer may still pass `PlayerInput.inputBuffer`, but it is no longer required for normal CMD matching. `stepGameByCns()` clones the previous `GameState.commandBuffers` entry, pushes the current frame input, and resolves commands from that buffer.

This prevents a common failure mode where `D, DF, F, x` never matches because only the current frame is visible.

### Command names are normalized

CNS command triggers should be treated case-insensitively.

```text
command = "QCF_X"
command = "qcf_x"
```

should match the same command. The current path normalizes runtime command names to lower-case, and `TriggerEvaluator` performs a case-insensitive fallback check.

### Buffer mutation is controlled

`InputBuffer.clone()` exists so game stepping can derive the next buffer from the previous state without mutating the previous `GameState` in place.

## File Responsibilities

### `src/parser/cmd/CmdParser.ts`

Parses raw `.cmd` text into `CmdDocument`. This preserves command name, command expression, and optional time.

### `src/input/CommandResolver.ts`

Currently used by the live `stepGameByCns()` path. It checks a `CmdDocument` against an `InputBuffer` and returns lower-case matched command names.

### `src/input/CommandMatcher.ts`

Parses command expressions such as `/F`, `~D, DF, F, x`, `/$D,a`, and `x+y` for the existing game-loop path.

### `src/core/engine/CnsGame.ts`

Owns the current live CMD application path. It attaches command names to `PlayerInput` before running CNS controllers.

### `src/core/engine/TriggerEvaluator.ts`

Evaluates CNS trigger expressions. For `command = "..."`, it checks `PlayerInput.commandNames` first, then legacy direct-input fallbacks.

### `src/app/BrowserInput.ts`

Tracks pressed browser keys and exposes `keysToP1Input()` / `keysToP2Input()` helpers. These helpers should be used by the app layer so CMD button names are available to the engine.

### `src/app/CmdControlHelp.ts`

Formats useful move/command help from `CmdDocument`. This is the intended replacement for hard-coded move help text.

### `src/core/cmd/*`

Contains the newer typed command runtime path and diagnostics. This path is useful for future cleanup and deeper command tracing, but the current live game-loop integration still uses `src/input/*`.

## Regression Tests To Preserve

- `src/core/engine/CmdIntegration.test.ts`
  - hold command triggers CNS ChangeState
  - buffered KFM-style `~D, DF, F, x` command triggers CNS ChangeState
- `src/input/CommandMatcher.test.ts`
  - `~`, `$`, `/`, simultaneous buttons, quarter-circle commands
- `src/input/CommandResolver.test.ts`
  - direct, hold, diagonal, and buffered command resolution
- `src/input/InputBufferClone.test.ts`
  - cloning does not mutate the original buffer
- `src/app/BrowserInput.test.ts`
  - browser keys map to MUGEN button names
- `src/app/CmdControlHelp.test.ts`
  - command help is generated from CMD definitions
- `src/core/engine/TriggerEvaluator.test.ts`
  - command triggers remain case-insensitive

## Known Limitations

Release-edge semantics for `~` are simplified. The marker is parsed and stripped, allowing common KFM commands to work, but the engine does not yet require an actual release transition.

Recommended future work:

```text
InputBuffer previous/current button state
  -> release edge detection
  -> CmdCommand token release flag
  -> exact MUGEN ~ command semantics
```

Do not mix that with command buffer persistence; buffer persistence and button-name support are now implemented and should remain stable.
