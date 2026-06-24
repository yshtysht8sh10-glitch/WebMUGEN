import type { PlayerInput } from '../core/engine/types';
import type { CmdDocument } from '../parser/cmd/CmdTypes';
import { inputToFrame, type InputBuffer } from './InputBuffer';
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
      activeCommandNames.add(command.name.toLowerCase());
    }
  }

  addRawDirectionCommandAliases(activeCommandNames, input);

  return {
    activeCommandNames,
  };
}

export function hasCommand(commandState: CommandState, commandName: string): boolean {
  return commandState.activeCommandNames.has(commandName.toLowerCase());
}

function addRawDirectionCommandAliases(commandNames: Set<string>, input: PlayerInput): void {
  if (input.up) {
    commandNames.add('holdup');
    commandNames.add('up');
  }

  if (input.down) {
    commandNames.add('holddown');
    commandNames.add('down');
  }

  if (input.right) {
    commandNames.add('holdfwd');
    commandNames.add('fwd');
  }

  if (input.left) {
    commandNames.add('holdback');
    commandNames.add('back');
  }

  if (input.right && input.up) {
    commandNames.add('holdfwd_up');
  }

  if (input.left && input.up) {
    commandNames.add('holdback_up');
  }

  if (input.right && input.down) {
    commandNames.add('holdfwd_down');
  }

  if (input.left && input.down) {
    commandNames.add('holdback_down');
  }
}
