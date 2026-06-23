import type { CmdCommandDefinition } from './CmdCommandParser';
import type { CommandMatchResult } from './CommandMatcher';

export type CommandDiagnosticsSummary = {
  definitionCount: number;
  matchedNames: string[];
  longestCommandTime: number;
};

export function summarizeCommandDiagnostics(
  definitions: readonly CmdCommandDefinition[],
  matches: readonly CommandMatchResult[],
): CommandDiagnosticsSummary {
  return {
    definitionCount: definitions.length,
    matchedNames: Array.from(new Set(matches.map((match) => match.commandName.toLowerCase()))).sort(),
    longestCommandTime: definitions.reduce((max, definition) => Math.max(max, definition.time), 0),
  };
}

export function formatCommandDiagnostics(summary: CommandDiagnosticsSummary): string[] {
  return [
    `cmd definitions=${summary.definitionCount} longestTime=${summary.longestCommandTime}`,
    `cmd matched=${summary.matchedNames.length > 0 ? summary.matchedNames.join(',') : '-'}`,
  ];
}
