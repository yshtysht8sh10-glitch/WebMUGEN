import { describe, expect, it } from 'vitest';
import { parseCmdText } from '../parser/cmd/CmdParser';
import { hasCommand, resolveCommands } from './CommandResolver';
import { InputBuffer } from './InputBuffer';

describe('CommandResolver', () => {
  const document = parseCmdText(`
[Command]
name = "holdfwd"
command = /F

[Command]
name = "holdfwd_up"
command = /F+/U

[Command]
name = "qcf_a"
command = D,DF,F,a
time = 15

[Command]
name = "a"
command = a
`);

  it('resolves hold command', () => {
    const buffer = new InputBuffer();
    const input = { left: false, right: true, up: false, down: false, attack: false };
    buffer.push(input);

    const state = resolveCommands(document, input, buffer);

    expect(hasCommand(state, 'holdfwd')).toBe(true);
    expect(hasCommand(state, 'qcf_a')).toBe(false);
  });

  it('resolves diagonal hold command', () => {
    const buffer = new InputBuffer();
    const input = { left: false, right: true, up: true, down: false, attack: false };
    buffer.push(input);

    const state = resolveCommands(document, input, buffer);

    expect(hasCommand(state, 'holdfwd_up')).toBe(true);
  });

  it('resolves button command', () => {
    const buffer = new InputBuffer();
    const input = { left: false, right: false, up: false, down: false, attack: true };
    buffer.push(input);

    const state = resolveCommands(document, input, buffer);

    expect(hasCommand(state, 'a')).toBe(true);
  });

  it('resolves buffered quarter-circle command', () => {
    const buffer = new InputBuffer(20);

    buffer.push({ left: false, right: false, up: false, down: true, attack: false });
    buffer.push({ left: false, right: true, up: false, down: true, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    const input = { left: false, right: false, up: false, down: false, attack: true };
    buffer.push(input);

    const state = resolveCommands(document, input, buffer);

    expect(hasCommand(state, 'qcf_a')).toBe(true);
  });

  it('adds raw up command aliases for CNS jump triggers', () => {
    const buffer = new InputBuffer();
    const input = { left: false, right: false, up: true, down: false, attack: false };
    buffer.push(input);

    const state = resolveCommands(document, input, buffer);

    expect(hasCommand(state, 'holdup')).toBe(true);
    expect(hasCommand(state, 'up')).toBe(true);
  });

  it('adds raw held diagonal command aliases', () => {
    const buffer = new InputBuffer();
    const input = { left: false, right: true, up: false, down: true, attack: false };
    buffer.push(input);

    const state = resolveCommands(document, input, buffer);

    expect(hasCommand(state, 'holdfwd')).toBe(true);
    expect(hasCommand(state, 'holddown')).toBe(true);
    expect(hasCommand(state, 'holdfwd_down')).toBe(true);
  });
});
