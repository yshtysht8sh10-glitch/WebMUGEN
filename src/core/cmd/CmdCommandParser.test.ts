import { describe, expect, it } from 'vitest';
import { parseCmdCommands, parseCommandExpression } from './CmdCommandParser';

describe('Phase89 CmdCommandParser', () => {
  it('parses command expressions into ordered steps', () => {
    expect(parseCommandExpression('D, DF, F, x')).toEqual([
      { tokens: ['D'], hold: false, release: false },
      { tokens: ['DF'], hold: false, release: false },
      { tokens: ['F'], hold: false, release: false },
      { tokens: ['x'], hold: false, release: false },
    ]);
  });

  it('parses [Command] sections', () => {
    const commands = parseCmdCommands(`
      [Command]
      name = "hadouken_x"
      command = D, DF, F, x
      time = 20
    `);

    expect(commands).toEqual([
      {
        name: 'hadouken_x',
        command: 'D, DF, F, x',
        time: 20,
        steps: [
          { tokens: ['D'], hold: false, release: false },
          { tokens: ['DF'], hold: false, release: false },
          { tokens: ['F'], hold: false, release: false },
          { tokens: ['x'], hold: false, release: false },
        ],
      },
    ]);
  });

  it('keeps hold and release hints on parsed steps', () => {
    expect(parseCommandExpression('~D, $F, x+y')).toEqual([
      { tokens: ['D'], hold: false, release: true },
      { tokens: ['F'], hold: true, release: false },
      { tokens: ['x', 'y'], hold: false, release: false },
    ]);
  });
});
