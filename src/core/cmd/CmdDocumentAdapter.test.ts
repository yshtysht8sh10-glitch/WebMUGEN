import { describe, expect, it } from 'vitest';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import { commandMatchesToCnsCommandSet, cmdDocumentToCommandDefinitions } from './CmdDocumentAdapter';

describe('Phase97 CmdDocumentAdapter', () => {
  it('converts parsed CMD document commands into runtime command definitions', () => {
    const document = parseCmdText(`
[Command]
name = "qcf_a"
command = D, DF, F, a
time = 20

[Command]
name = "empty"
command =
`);

    expect(cmdDocumentToCommandDefinitions(document)).toEqual([
      {
        name: 'qcf_a',
        command: 'D, DF, F, a',
        time: 20,
        steps: [
          { tokens: ['D'], hold: false, release: false },
          { tokens: ['DF'], hold: false, release: false },
          { tokens: ['F'], hold: false, release: false },
          { tokens: ['a'], hold: false, release: false },
        ],
      },
    ]);
  });

  it('converts matched runtime commands into CNS command names', () => {
    const commands = commandMatchesToCnsCommandSet([
      { matched: true, commandName: 'QCF_A', matchedFrames: [1, 2, 3, 4] },
      { matched: true, commandName: 'x', matchedFrames: [4] },
    ]);

    expect(commands.has('qcf_a')).toBe(true);
    expect(commands.has('x')).toBe(true);
  });
});
