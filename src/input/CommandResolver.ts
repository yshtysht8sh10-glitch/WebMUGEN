import type { CmdDocument } from '../parser/cmd/CmdTypes';
import type { PlayerInput } from '../core/engine/types';
import type { InputBuffer } from './InputBuffer';
import { inputToFrame } from './InputBuffer';
import { matchesCommand } from './CommandMatcher';

export type CommandState = {
  activeCommandNames: Set<string>;
};

export function resolveCommands(
  document: CmdDocument,
  input: PlayerInput,
  buffer?: InputBuffer,
): CommandState {
  const activeCommandNames = new Set<string>();
  const frames = buffer ? buffer.getFrames() : [inputToFrame(input)];

  for (const command of document.commands) {
    if (matchesCommand(command, frames)) {
      activeCommandNames.add(command.name);
    }
  }

  return {
    activeCommandNames,
  };
}

export function hasCommand(commandState: CommandState, commandName: string): boolean {
  return commandState.activeCommandNames.has(commandName);
}
