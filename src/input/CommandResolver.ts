import type { CmdDocument } from '../parser/cmd/CmdTypes';
import type { PlayerInput } from '../core/engine/types';

export type CommandState = {
  activeCommandNames: Set<string>;
};

export function resolveCommands(document: CmdDocument, input: PlayerInput): CommandState {
  const activeCommandNames = new Set<string>();

  for (const command of document.commands) {
    if (isCommandActive(command.command, input)) {
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

function isCommandActive(commandExpression: string, input: PlayerInput): boolean {
  const normalized = commandExpression.trim();

  switch (normalized) {
    case '/F':
    case 'F':
      return input.right;

    case '/B':
    case 'B':
      return input.left;

    case '/U':
    case 'U':
      return input.up ?? false;

    case '/D':
    case 'D':
      return input.down ?? false;

    case 'a':
      return input.attack;

    case 'F+U':
    case '/F+U':
      return input.right && (input.up ?? false);

    case 'B+U':
    case '/B+U':
      return input.left && (input.up ?? false);

    default:
      return false;
  }
}
