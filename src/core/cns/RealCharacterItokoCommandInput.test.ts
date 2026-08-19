import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { InputBuffer } from '../../input/InputBuffer';
import { hasCommand, resolveCommands } from '../../input/CommandResolver';
import { findCommand, parseCmdText } from '../../parser/cmd/CmdParser';
import type { PlayerInput } from '../engine/types';

const source = new TextDecoder('shift_jis').decode(
  readFileSync('public/chars/itoko/itoko.cmd'),
);
const commands = parseCmdText(source);
const neutral: PlayerInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  attack: false,
};

function resolveAfterBufferedDoubleTap(direction: 'B' | 'D') {
  const first = direction === 'B' ? { ...neutral, left: true } : { ...neutral, down: true };
  const finish = direction === 'B'
    ? { ...neutral, left: true, buttons: ['b'] }
    : { ...neutral, down: true, buttons: ['b'] };
  const buffer = new InputBuffer(20);
  for (const input of [first, neutral, finish, neutral]) {
    buffer.push(input, 1);
  }
  return resolveCommands(commands, neutral, buffer, 1);
}

describe('real itoko CMD input compatibility', () => {
  it('keeps the final simultaneous command intact after StateDef -1', () => {
    expect(findCommand(commands, 'z+c')).toEqual({
      name: 'z+c',
      command: 'z+c',
      time: 20,
    });
  });

  it('accepts the real simultaneous command when the final button is added', () => {
    const buffer = new InputBuffer(10);
    const z = { ...neutral, buttons: ['z'] };
    const chord = { ...neutral, buttons: ['z', 'c'] };
    buffer.push(z, 1);
    buffer.push(chord, 1);

    expect(hasCommand(resolveCommands(commands, chord, buffer, 1), 'z+c')).toBe(true);
  });

  it.each([
    ['B', 'ロケットパンチ'],
    ['D', '地震パンチ'],
  ] as const)('buffers the real %s double-tap plus b command', (direction, name) => {
    expect(hasCommand(resolveAfterBufferedDoubleTap(direction), name)).toBe(true);
  });
});
