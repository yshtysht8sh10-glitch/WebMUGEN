import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { InputBuffer } from '../../input/InputBuffer';
import { hasCommand, resolveCommands } from '../../input/CommandResolver';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { findCommand, parseCmdText } from '../../parser/cmd/CmdParser';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { createInitialGameState } from '../engine/GameState';
import type { PlayerInput } from '../engine/types';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const source = new TextDecoder('shift_jis').decode(
  readFileSync('public/chars/itoko/itoko.cmd'),
);
const commands = parseCmdText(source);
const cns = parseCnsText(new TextDecoder('shift_jis').decode(
  readFileSync('public/chars/itoko/itoko.cns'),
));
const air = parseAirText(new TextDecoder('shift_jis').decode(
  readFileSync('public/chars/itoko/itoko.air'),
));
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

  it('gives itoko button holds priority over the delayed b press so four-button release enters State 1335', () => {
    const buffer = new InputBuffer(10);
    buffer.push(neutral, 1);
    const chord = { ...neutral, buttons: ['x', 'y', 'a', 'b'] };
    buffer.push(chord, 1);
    const resolved = resolveCommands(commands, chord, buffer, 1).activeCommandNames;

    for (const command of ['hold_x', 'hold_y', 'hold_a', 'hold_b']) {
      expect(resolved.has(command)).toBe(true);
    }
    expect(resolved.has('b')).toBe(false);

    const state = createInitialGameState();
    state.players[0] = {
      ...state.players[0],
      stateNo: 1301,
      stateHeaderAppliedStateNo: 1301,
      stateTime: 25,
      stateType: 'S',
      moveType: 'I',
      physics: 'S',
      ctrl: false,
      animNo: 1310,
      animTime: 25,
    };

    const stepped = stepCnsStateRuntime(state, cns, {
      p1Commands: resolved,
      getAnimationDuration: (animNo) => getMugenAnimEndTime(air, animNo),
    }).state.players[0];
    expect(stepped.stateNo).toBe(1335);
  });

  it('preserves the ordinary b press one frame after its matching hold command', () => {
    const buffer = new InputBuffer(10);
    buffer.push(neutral, 1);
    const b = { ...neutral, buttons: ['b'] };
    buffer.push(b, 1);
    expect(hasCommand(resolveCommands(commands, b, buffer, 1), 'b')).toBe(false);

    buffer.push(b, 1);
    expect(hasCommand(resolveCommands(commands, b, buffer, 1), 'b')).toBe(true);
  });

  it.each([
    ['B', 'ロケットパンチ'],
    ['D', '地震パンチ'],
  ] as const)('buffers the real %s double-tap plus b command', (direction, name) => {
    expect(hasCommand(resolveAfterBufferedDoubleTap(direction), name)).toBe(true);
  });
});
