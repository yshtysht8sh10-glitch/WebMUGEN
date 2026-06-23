# CMD Runtime Integration Notes

This document records the current WebMUGEN CMD command path and the intended next steps.

## Current Status

WebMUGEN already parses character `.cmd` files and can evaluate simple command triggers in CNS.

The existing runtime path is:

```text
CharacterLoader
  -> parseCmdText(...)
  -> CharacterAssets.cmd
  -> stepGameByCns(..., cmdDocument)
  -> attachCommands(...)
  -> input/CommandResolver.resolveCommands(...)
  -> PlayerInput.commandNames
  -> CNS command trigger
```

This is why simple commands such as:

```ini
[Command]
name = "holdfwd"
command = /F
```

can drive CNS triggers such as:

```ini
trigger1 = command = "holdfwd"
```

## Added Bridge

The core command runtime also has a typed matcher path under `src/core/cmd`:

```text
CmdCommandParser
CommandMatcher
CommandRuntimeState
```

To avoid keeping parser CMD data and runtime command matching disconnected, `CmdDocumentAdapter` now bridges:

```text
parser/cmd CmdDocument
  -> core/cmd CmdCommandDefinition[]
```

This allows future game-loop work to use the typed runtime matcher without reparsing raw text.

## File Responsibilities

### `src/parser/cmd/CmdParser.ts`

Parses raw `.cmd` text into `CmdDocument`:

```ts
{ commands: CmdCommand[] }
```

This keeps the original command name, expression, and optional time.

### `src/core/cmd/CmdDocumentAdapter.ts`

Converts parsed `CmdDocument` into typed runtime definitions:

```ts
CmdCommandDefinition[]
```

It also converts command match results into a lower-case CNS command set.

### `src/core/cns/CnsCommandInput.ts`

Normalizes command names for CNS trigger evaluation. CNS command matching should be case-insensitive, so names are stored lower-case.

### `src/core/cmd/CommandDiagnostics.ts`

Summarizes command definitions and matched command names for debug overlays or trace output.

## Important Rule

CNS command triggers are string matches and should be treated case-insensitively:

```text
command = "QCF_X"
command = "qcf_x"
```

should refer to the same normalized command name.

## Known Split

There are currently two command-related paths:

```text
src/input/*       existing game-loop path
src/core/cmd/*    typed runtime matcher path
```

The current change does not replace the game-loop path. It adds adapter and diagnostic support so the two paths can be unified safely later.

## Next Recommended Step

The next step is to make the game loop persist command runtime state per player instead of relying only on `PlayerInput.inputBuffer` supplied from the app layer.

Suggested path:

```text
GameState
  -> p1CommandRuntime / p2CommandRuntime
  -> stepCommandRuntime each frame
  -> createCnsCommandSetFromMatches
  -> CnsRuntimeTriggerContext.commands
```

That change is larger because it touches `GameState` shape and app input flow. Keep it separate from parser and adapter cleanup.
