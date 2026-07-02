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
