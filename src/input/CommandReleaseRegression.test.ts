import { describe, expect, it } from 'vitest';
import type { PlayerInput } from '../core/engine/types';
import { parseCmdText } from '../parser/cmd/CmdParser';
import { InputBuffer } from './InputBuffer';
import { hasCommand, resolveCommands } from './CommandResolver';

const commandName = 'ダークネスフィンガー 撃ち付けx';
const neutral: PlayerInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  attack: false,
};

function directionalInput(
  direction: 'D' | 'DB' | 'B' | 'F',
  facing: 1 | -1,
  buttons: string[] = [],
): PlayerInput {
  const forward = facing === 1 ? 'right' : 'left';
  const back = facing === 1 ? 'left' : 'right';
  return {
    ...neutral,
    down: direction === 'D' || direction === 'DB',
    [forward]: direction === 'F',
    [back]: direction === 'DB' || direction === 'B',
    buttons,
  };
}

function resolveMotion(options: {
  button?: 'x' | 'y';
  facing?: 1 | -1;
  totalFrames?: number;
  releaseDown?: boolean;
  buttonOnForward?: boolean;
  command?: string;
  time?: number;
}) {
  const {
    button = 'x',
    facing = 1,
    totalFrames = 5,
    releaseDown = true,
    buttonOnForward = false,
    command = `~D, DB, B, F, ${button}`,
    time = 25,
  } = options;
  const buffer = new InputBuffer(60);
  const inputs: PlayerInput[] = [directionalInput('D', facing)];
  const baseFrameCount = buttonOnForward ? 4 : 5;
  inputs.push(...Array.from({ length: totalFrames - baseFrameCount }, () => neutral));
  inputs.push(directionalInput('DB', facing));
  inputs.push(
    releaseDown
      ? directionalInput('B', facing)
      : { ...directionalInput('DB', facing) },
  );
  inputs.push(
    releaseDown
      ? directionalInput('F', facing, buttonOnForward ? [button] : [])
      : { ...directionalInput('F', facing, buttonOnForward ? [button] : []), down: true },
  );
  if (!buttonOnForward) {
    inputs.push({ ...neutral, down: !releaseDown, buttons: [button] });
  }
  for (const input of inputs) buffer.push(input, facing);

  const document = parseCmdText(`
[Command]
name = "${commandName}"
command = ${command}
time = ${time}

[Command]
name = "short"
command = F, ${button}
time = ${time}
`);
  const input = inputs[inputs.length - 1];
  return resolveCommands(document, input, buffer, facing);
}

describe('release command regression', () => {
  it.each([
    ['x', 1],
    ['y', 1],
    ['x', -1],
    ['y', -1],
  ] as const)('matches the %s version while facing %i', (button, facing) => {
    expect(hasCommand(resolveMotion({ button, facing }), commandName)).toBe(true);
  });

  it.each([
    [24, true],
    [25, true],
    [26, false],
  ])('applies command.time=25 to a %i-frame sequence', (totalFrames, expected) => {
    expect(hasCommand(resolveMotion({ totalFrames }), commandName)).toBe(expected);
  });

  it('distinguishes ~D release from an ordinary D sequence', () => {
    expect(hasCommand(resolveMotion({ releaseDown: false }), commandName)).toBe(false);
    expect(
      hasCommand(
        resolveMotion({ releaseDown: false, command: 'D, DB, B, F, x' }),
        commandName,
      ),
    ).toBe(true);
  });

  it('accepts a one-frame DB and a rapid B-to-F reversal', () => {
    expect(hasCommand(resolveMotion({}), commandName)).toBe(true);
  });

  it('accepts the button on the F frame or the immediately following frame', () => {
    expect(hasCommand(resolveMotion({ buttonOnForward: true, totalFrames: 4 }), commandName)).toBe(
      true,
    );
    expect(hasCommand(resolveMotion({ buttonOnForward: false }), commandName)).toBe(true);
  });

  it('preserves the Japanese name and does not let a shorter command preempt it', () => {
    const state = resolveMotion({ buttonOnForward: true, totalFrames: 4 });
    expect(hasCommand(state, commandName)).toBe(true);
    expect(hasCommand(state, 'short')).toBe(true);
  });
});
