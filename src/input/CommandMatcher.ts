import type { CmdCommand } from '../parser/cmd/CmdTypes';
import type { DirectionToken, InputFrame } from './InputBuffer';

export type CommandToken =
  | { kind: 'direction'; value: DirectionToken; hold: boolean }
  | { kind: 'button'; value: string; hold: boolean };

export type CommandStep = {
  tokens: CommandToken[];
};

export function parseCommandTokens(command: string): CommandToken[] {
  return parseCommandSteps(command).flatMap((step) => step.tokens);
}

export function parseCommandSteps(command: string): CommandStep[] {
  return command
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(parseCommandStep);
}

export function matchesCommand(command: CmdCommand, frames: readonly InputFrame[]): boolean {
  const bufferTime = Math.max(0, command.bufferTime ?? 0);
  for (let offset = 0; offset <= bufferTime; offset += 1) {
    if (matchesCommandAtOffset(command, frames.slice(offset))) return true;
  }

  return false;
}

function matchesCommandAtOffset(command: CmdCommand, frames: readonly InputFrame[]): boolean {
  const steps = parseCommandSteps(command.command);
  if (steps.length === 0) {
    return false;
  }

  const timeLimit = command.time ?? 15;
  const searchFrames = frames.slice(0, timeLimit);

  let frameIndex = 0;
  let previousMatchedFrameIndex = -1;

  for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const step = steps[stepIndex];

    const allowSameFrame =
      previousMatchedFrameIndex >= 0 &&
      canShareFrame(step, steps[stepIndex + 1]) &&
      stepMatchesFrame(step, searchFrames[previousMatchedFrameIndex]);

    if (allowSameFrame) {
      frameIndex = previousMatchedFrameIndex + 1;
      continue;
    }

    const foundIndex = findStep(
      step,
      searchFrames,
      frameIndex,
      shouldRequireFreshRepeatedDirection(step, steps[stepIndex + 1]),
    );

    if (foundIndex < 0) {
      return false;
    }

    previousMatchedFrameIndex = foundIndex;
    frameIndex = foundIndex + 1;
  }

  return true;
}

function parseCommandStep(part: string): CommandStep {
  return {
    tokens: part
      .split('+')
      .map((piece) => piece.trim())
      .filter((piece) => piece.length > 0)
      .map(parseCommandToken),
  };
}

function parseCommandToken(part: string): CommandToken {
  const normalizedPart = part.trim();
  const hold = normalizedPart.includes('/') || normalizedPart.includes('$');
  const raw = normalizedPart.replace(/[~/$]/g, '');

  if (isDirectionToken(raw)) {
    return { kind: 'direction', value: raw, hold };
  }

  return { kind: 'button', value: raw.toLowerCase(), hold };
}

function findStep(
  step: CommandStep,
  frames: readonly InputFrame[],
  startIndex: number,
  requireFreshDirection: boolean,
): number {
  for (let index = startIndex; index < frames.length; index += 1) {
    if (stepMatchesFrame(step, frames[index]) && (!requireFreshDirection || isFreshDirectionStep(step, frames, index))) {
      return index;
    }

    if (step.tokens.some((token) => token.hold)) {
      break;
    }
  }

  return -1;
}

function stepMatchesFrame(step: CommandStep, frame: InputFrame | undefined): boolean {
  if (!frame) {
    return false;
  }

  return step.tokens.every((token) => frameMatchesToken(frame, token));
}

function frameMatchesToken(frame: InputFrame, token: CommandToken): boolean {
  if (token.kind === 'direction') {
    return directionContains(frame.direction, token.value);
  }

  return frame.buttons.has(token.value);
}

function canShareFrame(previousDirectionStep: CommandStep, laterStep: CommandStep | undefined): boolean {
  if (!laterStep) {
    return false;
  }

  const previousIsDirectionOnly = previousDirectionStep.tokens.every(
    (token) => token.kind === 'direction',
  );
  const laterHasButton = laterStep.tokens.some((token) => token.kind === 'button');

  return previousIsDirectionOnly && laterHasButton;
}

function shouldRequireFreshRepeatedDirection(step: CommandStep, laterStep: CommandStep | undefined): boolean {
  const direction = singleNonHoldDirection(step);
  const laterDirection = laterStep ? singleNonHoldDirection(laterStep) : null;
  return direction !== null && direction === laterDirection;
}

function isFreshDirectionStep(step: CommandStep, frames: readonly InputFrame[], index: number): boolean {
  const direction = singleNonHoldDirection(step);
  if (!direction) return true;

  const newerFrame = frames[index - 1];
  return !newerFrame || !directionContains(newerFrame.direction, direction);
}

function singleNonHoldDirection(step: CommandStep): DirectionToken | null {
  if (step.tokens.length !== 1) return null;
  const [token] = step.tokens;
  return token.kind === 'direction' && !token.hold ? token.value : null;
}

function directionContains(actual: DirectionToken, expected: DirectionToken): boolean {
  if (actual === expected) {
    return true;
  }

  if (expected === 'F') return actual === 'DF' || actual === 'UF';
  if (expected === 'B') return actual === 'DB' || actual === 'UB';
  if (expected === 'D') return actual === 'DF' || actual === 'DB';
  if (expected === 'U') return actual === 'UF' || actual === 'UB';

  return false;
}

function isDirectionToken(value: string): value is DirectionToken {
  return ['N', 'F', 'B', 'U', 'D', 'DF', 'DB', 'UF', 'UB'].includes(value);
}
