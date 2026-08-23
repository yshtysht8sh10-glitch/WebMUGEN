import { describe, expect, it } from 'vitest';
import { findCommand, parseCmdText } from './CmdParser';

describe('parseCmdText', () => {
  it('parses command blocks', () => {
    const document = parseCmdText(`
[Command]
name = "holdfwd"
command = /F
time = 1
buffer.time = 3

[Command]
name = "a"
command = a
time = 1
`);

    expect(document.commands).toHaveLength(2);
    expect(findCommand(document, 'holdfwd')).toEqual({
      name: 'holdfwd',
      command: '/F',
      time: 1,
      bufferTime: 3,
    });
    expect(findCommand(document, 'a')?.command).toBe('a');
  });

  it('applies CMD defaults even when the Defaults section follows the commands', () => {
    const document = parseCmdText(`
[Command]
name = "motion"
command = ~D, D, b

[Defaults]
command.time = 20
command.buffer.time = 2
`);

    expect(findCommand(document, 'motion')).toEqual({
      name: 'motion',
      command: '~D, D, b',
      time: 20,
      bufferTime: 2,
    });
  });

  it('stops parsing a Command block when StateDef -1 begins', () => {
    const document = parseCmdText(`
[Command]
name = "chord"
command = x+y+a+b
time = 20

[Statedef -1]
[State -1, ChangeState]
type = ChangeState
trigger1 = command = "other"
value = 1000
`);

    expect(document.commands).toEqual([
      { name: 'chord', command: 'x+y+a+b', time: 20 },
    ]);
  });

  it('ignores comments', () => {
    const document = parseCmdText(`
; comment
[Command] ; block
name = "holdup"
command = /U ; hold up
`);

    expect(findCommand(document, 'holdup')?.command).toBe('/U');
  });
});
