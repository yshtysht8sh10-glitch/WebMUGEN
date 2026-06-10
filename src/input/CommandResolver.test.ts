import { describe, expect, it } from 'vitest';
import { parseCmdText } from '../parser/cmd/CmdParser';
import { hasCommand, resolveCommands } from './CommandResolver';

describe('CommandResolver', () => {
  const document = parseCmdText(`
[Command]
name = "holdfwd"
command = /F

[Command]
name = "holdfwd_up"
command = /F+U

[Command]
name = "a"
command = a
`);

  it('resolves hold command', () => {
    const state = resolveCommands(document, {
      left: false,
      right: true,
      up: false,
      attack: false,
    });

    expect(hasCommand(state, 'holdfwd')).toBe(true);
    expect(hasCommand(state, 'holdfwd_up')).toBe(false);
  });

  it('resolves diagonal hold command', () => {
    const state = resolveCommands(document, {
      left: false,
      right: true,
      up: true,
      attack: false,
    });

    expect(hasCommand(state, 'holdfwd')).toBe(true);
    expect(hasCommand(state, 'holdfwd_up')).toBe(true);
  });

  it('resolves button command', () => {
    const state = resolveCommands(document, {
      left: false,
      right: false,
      up: false,
      attack: true,
    });

    expect(hasCommand(state, 'a')).toBe(true);
  });
});
