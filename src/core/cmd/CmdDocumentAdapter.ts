import type { CmdDocument } from '../../parser/cmd/CmdTypes';
import { parseCommandExpression, type CmdCommandDefinition } from './CmdCommandParser';
import type { CommandMatchResult } from './CommandMatcher';

export function cmdDocumentToCommandDefinitions(document: CmdDocument): CmdCommandDefinition[] {
  return document.commands
    .map((command): CmdCommandDefinition => ({
      name: command.name,
      command: command.command,
      time: command.time ?? 15,
      steps: parseCommandExpression(command.command),
    }))
    .filter((definition) => definition.steps.length > 0);
}

export function commandMatchesToCnsCommandSet(matches: readonly CommandMatchResult[]): ReadonlySet<string> {
  return new Set(matches.map((match) => match.commandName.toLowerCase()));
}
