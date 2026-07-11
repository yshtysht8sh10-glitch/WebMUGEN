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

[Command]
name = "FF"
command = F, F
time = 10

[Command]
name = "BB"
command = B, B
time = 10
`);

  const neutral = { left: false, right: false, up: false, down: false, attack: false };

  function doubleTap(
    physicalDirection: 'left' | 'right',
    facing: 1 | -1,
    buffer = new InputBuffer(20),
  ) {
    const pressed = { ...neutral, [physicalDirection]: true };
    buffer.push(pressed, facing);
    buffer.push(neutral, facing);
    buffer.push(pressed, facing);
    return resolveCommands(document, pressed, buffer, facing);
  }

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

  it('resolves Right x2 as forward dash while facing right', () => {
    expect(hasCommand(doubleTap('right', 1), 'FF')).toBe(true);
  });

  it('resolves Left x2 as back dash while facing right', () => {
    const state = doubleTap('left', 1);
    expect(hasCommand(state, 'BB')).toBe(true);
    expect(hasCommand(state, 'FF')).toBe(false);
  });

  it('resolves Left x2 as forward dash while facing left', () => {
    expect(hasCommand(doubleTap('left', -1), 'FF')).toBe(true);
  });

  it('does not resolve Right x2 as forward dash while facing left', () => {
    const state = doubleTap('right', -1);
    expect(hasCommand(state, 'FF')).toBe(false);
    expect(hasCommand(state, 'BB')).toBe(true);
  });

  it('uses the new facing immediately after a cross-over', () => {
    const buffer = new InputBuffer(20);
    buffer.push({ ...neutral, right: true }, 1);
    buffer.push(neutral, 1);

    const firstAfterCrossOver = { ...neutral, left: true };
    buffer.push(firstAfterCrossOver, -1);
    expect(hasCommand(resolveCommands(document, firstAfterCrossOver, buffer, -1), 'FF')).toBe(false);

    buffer.push(neutral, -1);
    buffer.push(firstAfterCrossOver, -1);
    expect(hasCommand(resolveCommands(document, firstAfterCrossOver, buffer, -1), 'FF')).toBe(true);
  });

  it('does not reuse pre-flip direction history as forward after facing changes', () => {
    const buffer = new InputBuffer(20);
    buffer.push({ ...neutral, right: true }, 1);
    buffer.push(neutral, 1);

    const postFlipForward = { ...neutral, left: true };
    buffer.push(postFlipForward, -1);
    const state = resolveCommands(document, postFlipForward, buffer, -1);

    expect(hasCommand(state, 'FF')).toBe(false);
  });
});
