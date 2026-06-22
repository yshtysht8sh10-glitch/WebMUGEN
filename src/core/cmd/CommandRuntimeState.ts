import { createInputBuffer, pushInputFrame, type InputBuffer } from '../input/InputBuffer';
import type { InputSnapshot } from '../input/InputTypes';
import { matchCommands, type CommandMatchResult } from './CommandMatcher';
import type { CmdCommandDefinition } from './CmdCommandParser';

export type CommandRuntimeState = {
  inputBuffer: InputBuffer;
  matchedCommands: CommandMatchResult[];
};

export function createCommandRuntimeState(maxFrames = 60): CommandRuntimeState {
  return {
    inputBuffer: createInputBuffer(maxFrames),
    matchedCommands: [],
  };
}

export function stepCommandRuntime(
  state: CommandRuntimeState,
  commands: readonly CmdCommandDefinition[],
  frame: number,
  snapshot: InputSnapshot,
): CommandRuntimeState {
  const inputBuffer = pushInputFrame(state.inputBuffer, frame, snapshot);

  return {
    inputBuffer,
    matchedCommands: matchCommands(commands, inputBuffer, frame),
  };
}

export function hasMatchedCommand(state: CommandRuntimeState, name: string): boolean {
  return state.matchedCommands.some((command) => command.commandName === name);
}
