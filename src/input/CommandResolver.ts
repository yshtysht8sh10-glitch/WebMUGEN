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
  facing: 1 | -1 = 1,
): CommandState {
  const activeCommandNames = new Set<string>();
  const frames = buffer ? buffer.getFrames() : [inputToFrame(input, facing)];

  for (const command of document.commands) {
    if (matchesCommand(command, frames)) {
      activeCommandNames.add(command.name.toLowerCase());
    }
  }

  addRawDirectionCommandAliases(activeCommandNames, input, facing);

  return {
    activeCommandNames,
  };
}

export function hasCommand(commandState: CommandState, commandName: string): boolean {
  return commandState.activeCommandNames.has(commandName.toLowerCase());
}

function addRawDirectionCommandAliases(commandNames: Set<string>, input: PlayerInput, facing: 1 | -1): void {
  const forward = facing === 1 ? input.right : input.left;
  const back = facing === 1 ? input.left : input.right;
  if (input.up) {
    commandNames.add('holdup');
    commandNames.add('up');
  }

  if (input.down) {
    commandNames.add('holddown');
    commandNames.add('down');
  }

  if (forward) {
    commandNames.add('holdfwd');
    commandNames.add('fwd');
  }

  if (back) {
    commandNames.add('holdback');
    commandNames.add('back');
  }

  if (forward && input.up) {
    commandNames.add('holdfwd_up');
  }

  if (back && input.up) {
    commandNames.add('holdback_up');
  }

  if (forward && input.down) {
    commandNames.add('holdfwd_down');
  }

  if (back && input.down) {
    commandNames.add('holdback_down');
  }
}
