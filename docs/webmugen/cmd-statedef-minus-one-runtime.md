# CMD Statedef -1 Runtime

## Problem

MUGEN `.cmd` files contain two different kinds of data:

1. `[Command]` entries that define input sequences such as `QCF_x`.
2. `[Statedef -1]` controllers that map resolved command names to gameplay states with `ChangeState`.

Rendering CMD-derived help only proves that `[Command]` entries were parsed. It does not prove that gameplay can enter the states defined by the character. For KFM, special moves such as `QCF_x` are wired through `.cmd` `[Statedef -1]`, not through fallback controls.

## Runtime Flow

The expected runtime path is:

```text
keyboard
  -> PlayerInput buttons/directions
  -> InputBuffer
  -> resolveCommands(cmd)
  -> active command names, e.g. qcf_x
  -> CNS runtime evaluates [Statedef -1]
  -> triggerall = command = "QCF_x"
  -> ChangeState value = 1000
  -> current player state becomes 1000
```

## Important Details

`[Statedef -1]` is a common command state. It must be evaluated every frame before the player's current state. If a controller in state `-1` changes state, the runtime should move the player to that destination state immediately.

`triggerall` is required. KFM commonly uses:

```text
triggerall = command = "QCF_x"
trigger1 = statetype != A
trigger1 = ctrl
```

This means all `triggerall` expressions must pass, then any numbered trigger group may pass.

`command != "holddown"` also matters for separating standing attacks from crouching attacks.

## Current Implementation Notes

- `CharacterLoader` parses `.cmd` twice:
  - `parseCmdText(cmdText)` for command definitions.
  - `parseCnsText(cmdText)` for `[Statedef -1]` controllers.
- The parsed CMD CNS states are merged with the main `.cns` document.
- `CnsStateRuntime` evaluates state `-1` before the player's current state.
- `CnsRuntimeTrigger` supports `triggerall`, `command =`, `command !=`, and simple `power` comparisons.

## Regression Coverage

Relevant tests:

- `src/parser/cns/CnsParser.test.ts`
  - parses `triggerall`.
- `src/core/cns/CnsRuntimeTrigger.test.ts`
  - evaluates `triggerall` and command inequality.
- `src/core/cns/CnsCommandStateRuntime.test.ts`
  - verifies `[Statedef -1]` can change to a command state such as `1000`.
- `src/core/character/CharacterLoader.test.ts`
  - verifies CMD `[Statedef -1]` is loaded into the character CNS document.
