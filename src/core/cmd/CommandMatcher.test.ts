import { describe, expect, it } from 'vitest';
import { createInputBuffer, pushInputFrame } from '../input/InputBuffer';
import { parseCmdCommands } from './CmdCommandParser';
import { matchCommand, matchCommands } from './CommandMatcher';

describe('Phase90 CommandMatcher', () => {
  it('matches command steps against recent input history', () => {
    const [command] = parseCmdCommands(`
      [Command]
      name = "hadouken_x"
      command = D, DF, F, x
      time = 12
    `);

    let buffer = createInputBuffer();
    buffer = pushInputFrame(buffer, 10, { direction: 'D', buttons: [] });
    buffer = pushInputFrame(buffer, 12, { direction: 'DF', buttons: [] });
    buffer = pushInputFrame(buffer, 14, { direction: 'F', buttons: [] });
    buffer = pushInputFrame(buffer, 15, { direction: 'F', buttons: ['x'] });

    expect(matchCommand(command, buffer, 15)).toEqual({
      matched: true,
      commandName: 'hadouken_x',
      matchedFrames: [10, 12, 14, 15],
    });
  });

  it('does not match inputs outside command time', () => {
    const [command] = parseCmdCommands(`
      [Command]
      name = "slow"
      command = D, F, x
      time = 3
    `);

    let buffer = createInputBuffer();
    buffer = pushInputFrame(buffer, 1, { direction: 'D', buttons: [] });
    buffer = pushInputFrame(buffer, 8, { direction: 'F', buttons: [] });
    buffer = pushInputFrame(buffer, 9, { direction: 'F', buttons: ['x'] });

    expect(matchCommand(command, buffer, 9).matched).toBe(false);
  });

  it('returns all matched commands', () => {
    const commands = parseCmdCommands(`
      [Command]
      name = "x"
      command = x

      [Command]
      name = "y"
      command = y
    `);

    let buffer = createInputBuffer();
    buffer = pushInputFrame(buffer, 1, { direction: 'N', buttons: ['x'] });

    expect(matchCommands(commands, buffer, 1).map((result) => result.commandName)).toEqual(['x']);
  });
});
