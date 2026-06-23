# CMD Runtime Integration Notes

This document records the current WebMUGEN CMD command path. Keep it current: CMD bugs are easy to misdiagnose because parser, input history, command matching, and CNS triggers are separate layers.

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
name = "qcf_a"
command = D, DF, F, a
time = 20
```

can drive:

```ini
[State 0, Special]
type = ChangeState
trigger1 = command = "qcf_a"
value = 300
```

The integration test `src/core/engine/CmdIntegration.test.ts` covers this buffered transition.

## Runtime State

`GameState` now carries command runtime data:

```ts
commandBuffers?: [InputBuffer, InputBuffer];
commandNames?: [ReadonlySet<string>, ReadonlySet<string>];
```

`commandBuffers` preserve per-player input history across calls to `stepGameByCns()`. This is required for multi-step commands such as quarter-circle motions.

`commandNames` expose the current frame's matched command names for debug overlays and future runtime tracing.

## Important Implementation Details

### Input history is internal to `stepGameByCns()`

The app layer may still pass `PlayerInput.inputBuffer`, but it is no longer required for normal CMD matching. `stepGameByCns()` clones the previous `GameState.commandBuffers` entry, pushes the current frame input, and resolves commands from that buffer.

This prevents a common failure mode where `D, DF, F, a` never matches because only the current frame is visible.

### Command names are normalized

CNS command triggers should be treated case-insensitively.

```text
command = "QCF_A"
command = "qcf_a"
```

should match the same command. The current path normalizes runtime command names to lower-case, and `TriggerEvaluator` performs a case-insensitive fallback check.

### Buffer mutation is controlled

`InputBuffer.clone()` exists so game stepping can derive the next buffer from the previous state without mutating the previous `GameState` in place.

## File Responsibilities

### `src/parser/cmd/CmdParser.ts`

Parses raw `.cmd` text into:

```ts
CmdDocument
```

This preserves command name, command expression, and optional time.

### `src/input/CommandResolver.ts`

Currently used by the live `stepGameByCns()` path. It checks a `CmdDocument` against an `InputBuffer` and returns matched command names.

### `src/input/CommandMatcher.ts`

Parses command expressions such as `/F`, `D,DF,F,a`, and `F+a` for the existing game-loop path.

### `src/core/engine/CnsGame.ts`

Owns the current live CMD application path. It attaches command names to `PlayerInput` before running CNS controllers.

### `src/core/engine/TriggerEvaluator.ts`

Evaluates CNS trigger expressions. For `command = "..."`, it checks `PlayerInput.commandNames` first, then legacy direct-input fallbacks.

### `src/core/cmd/*`

Contains the newer typed command runtime path and diagnostics. This path is useful for future cleanup and deeper command tracing, but the current live game-loop integration still uses `src/input/*`.

## Regression Tests To Preserve

- `src/core/engine/CmdIntegration.test.ts`
  - hold command triggers CNS ChangeState
  - buffered `D, DF, F, a` command triggers CNS ChangeState
- `src/input/CommandResolver.test.ts`
  - direct, hold, diagonal, and buffered command resolution
- `src/input/InputBufferClone.test.ts`
  - cloning does not mutate the original buffer
- `src/core/engine/TriggerEvaluator.test.ts` or equivalent future coverage
  - command triggers remain case-insensitive

## Known Limitations

Only one generic attack button currently maps to `a` in `inputToFrame()`. KFM command files may use buttons such as `x`, `y`, `z`, `a`, `b`, `c` depending on source data. Full MUGEN-style button mapping needs a separate input model expansion.

Recommended next step:

```text
PlayerInput.attack
  -> explicit buttons: a/b/c/x/y/z
  -> BrowserInput key map
  -> InputBuffer button Set
  -> CMD matching by actual button names
```

Do not mix that with command buffer persistence; buffer persistence is now implemented and should remain stable.
