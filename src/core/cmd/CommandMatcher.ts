import type { InputBuffer } from '../input/InputBuffer';
import type { InputFrame, InputToken } from '../input/InputTypes';
import type { CmdCommandDefinition, CmdCommandStep } from './CmdCommandParser';

export type CommandMatchResult = {
  matched: boolean;
  commandName: string;
  matchedFrames: number[];
};

export function matchCommand(
  command: CmdCommandDefinition,
  buffer: InputBuffer,
  currentFrame: number,
): CommandMatchResult {
  const bufferTime = Math.max(0, command.bufferTime);
  for (let offset = 0; offset <= bufferTime; offset += 1) {
    const result = matchCommandAtFrame(command, buffer, currentFrame - offset);
    if (result.matched) return result;
  }

  return { matched: false, commandName: command.name, matchedFrames: [] };
}

function matchCommandAtFrame(
  command: CmdCommandDefinition,
  buffer: InputBuffer,
  currentFrame: number,
): CommandMatchResult {
  const windowStart = currentFrame - command.time + 1;
  const frames = buffer.frames.filter((frame) => frame.frame >= windowStart && frame.frame <= currentFrame);
  const matchedFrames: number[] = [];
  let frameCursor = frames.length - 1;

  for (let stepIndex = command.steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const step = command.steps[stepIndex];
    const foundIndex = findStepFrameIndex(frames, frameCursor, step);

    if (foundIndex < 0) {
      return { matched: false, commandName: command.name, matchedFrames: [] };
    }

    matchedFrames.unshift(frames[foundIndex].frame);
    frameCursor = foundIndex - 1;
  }

  return {
    matched: true,
    commandName: command.name,
    matchedFrames,
  };
}

export function matchCommands(
  commands: readonly CmdCommandDefinition[],
  buffer: InputBuffer,
  currentFrame: number,
): CommandMatchResult[] {
  return commands
    .map((command) => matchCommand(command, buffer, currentFrame))
    .filter((result) => result.matched);
}

function findStepFrameIndex(frames: readonly InputFrame[], startIndex: number, step: CmdCommandStep): number {
  for (let index = startIndex; index >= 0; index -= 1) {
    if (frameMatchesStep(frames[index], step)) {
      return index;
    }
  }

  return -1;
}

function frameMatchesStep(frame: InputFrame, step: CmdCommandStep): boolean {
  return step.tokens.every((token) => frameHasToken(frame, token));
}

function frameHasToken(frame: InputFrame, token: InputToken): boolean {
  return frame.tokens.includes(token);
}
