import { describe, expect, it } from 'vitest';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import { cmdDocumentToCommandDefinitions } from './CmdDocumentAdapter';
import { formatCommandDiagnostics, summarizeCommandDiagnostics } from './CommandDiagnostics';

describe('Phase100 CommandDiagnostics', () => {
  it('summarizes command definitions and matches', () => {
    const definitions = cmdDocumentToCommandDefinitions(parseCmdText(`
[Command]
name = "x"
command = x
time = 1

[Command]
name = "qcf_x"
command = D, DF, F, x
time = 20
`));

    const summary = summarizeCommandDiagnostics(definitions, [
      { matched: true, commandName: 'QCF_X', matchedFrames: [1, 2, 3, 4] },
    ]);

    expect(summary).toEqual({
      definitionCount: 2,
      matchedNames: ['qcf_x'],
      longestCommandTime: 20,
    });
    expect(formatCommandDiagnostics(summary)).toEqual([
      'cmd definitions=2 longestTime=20',
      'cmd matched=qcf_x',
    ]);
  });
});
