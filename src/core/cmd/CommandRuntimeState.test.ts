import { describe, expect, it } from 'vitest';
import { parseCmdCommands } from './CmdCommandParser';
import { createCommandRuntimeState, hasMatchedCommand, stepCommandRuntime } from './CommandRuntimeState';

describe('Phase91 CommandRuntimeState', () => {
  it('updates input buffer and exposes matched command names per frame', () => {
    const commands = parseCmdCommands(`
      [Command]
      name = "hadouken_x"
      command = D, DF, F, x
      time = 20
    `);

    let state = createCommandRuntimeState();
    state = stepCommandRuntime(state, commands, 1, { direction: 'D', buttons: [] });
    state = stepCommandRuntime(state, commands, 2, { direction: 'DF', buttons: [] });
    state = stepCommandRuntime(state, commands, 3, { direction: 'F', buttons: [] });

    expect(hasMatchedCommand(state, 'hadouken_x')).toBe(false);

    state = stepCommandRuntime(state, commands, 4, { direction: 'F', buttons: ['x'] });

    expect(hasMatchedCommand(state, 'hadouken_x')).toBe(true);
    expect(state.matchedCommands[0].matchedFrames).toEqual([1, 2, 3, 4]);
  });
});
