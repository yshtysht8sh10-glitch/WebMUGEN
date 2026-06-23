import { describe, expect, it } from 'vitest';
import { parseCmdText } from '../parser/cmd/CmdParser';
import { formatCmdControlHelp, formatCommandExpression, selectCommandHelpLines } from './CmdControlHelp';

describe('CmdControlHelp', () => {
  it('formats command expressions for display', () => {
    expect(formatCommandExpression('~D, DF, F, x+y')).toBe('↓, ↓→, →, x+y');
    expect(formatCommandExpression('/$D,a')).toBe('↓, a');
  });

  it('selects useful commands from a CMD document', () => {
    const document = parseCmdText(`
[Command]
name = "a"
command = a

[Command]
name = "holdfwd"
command = /$F

[Command]
name = "QCF_x"
command = ~D, DF, F, x

[Command]
name = "FF"
command = F, F
`);

    expect(selectCommandHelpLines(document)).toEqual([
      { name: 'QCF_x', command: '~D, DF, F, x', display: '↓, ↓→, →, x' },
      { name: 'FF', command: 'F, F', display: '→, →' },
    ]);
  });

  it('formats control help lines', () => {
    const document = parseCmdText(`
[Command]
name = "QCF_x"
command = ~D, DF, F, x
`);

    expect(formatCmdControlHelp(document)).toEqual(['QCF_x: ↓, ↓→, →, x']);
  });
});
