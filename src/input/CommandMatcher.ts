import type { CmdCommand } from '../parser/cmd/CmdTypes';
import type { DirectionToken, InputFrame } from './InputBuffer';

export type CommandToken =
  | { kind: 'direction'; value: DirectionToken; hold: boolean; release: boolean }
  | { kind: 'button'; value: string; hold: boolean; release: boolean };

export type CommandStep = {
  tokens: CommandToken[];
};

const DEFAULT_DOUBLE_TAP_DIRECTION_BUFFER_TIME = 3;
const DEFAULT_BUTTON_BUFFER_TIME = 3;

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
  if (isHeldFinalButton(command, frames)) {
    return false;
  }

  const bufferTime = Math.max(0, command.bufferTime ?? defaultBufferTime(command));
  const doubleTapDirection = doubleTapDirectionCommandDirection(command);
  for (let offset = 0; offset <= bufferTime; offset += 1) {
    if (
      offset > 0 &&
      doubleTapDirection &&
      directionContains(frames[0]?.direction ?? 'N', doubleTapDirection)
    ) {
      continue;
    }

    if (matchesCommandAtOffset(command, frames.slice(offset), doubleTapDirection !== null)) return true;
  }

  return false;
}

function defaultBufferTime(command: CmdCommand): number {
  const steps = parseCommandSteps(command.command);
  if (isSingleButtonCommand(steps)) {
    return DEFAULT_BUTTON_BUFFER_TIME;
  }

  if (isDoubleTapDirectionCommand(steps)) {
    return DEFAULT_DOUBLE_TAP_DIRECTION_BUFFER_TIME;
  }

  return 0;
}

function isSingleButtonCommand(steps: readonly CommandStep[]): boolean {
  return steps.length === 1 && steps[0].tokens.every((token) => token.kind === 'button');
}

function isHeldFinalButton(command: CmdCommand, frames: readonly InputFrame[]): boolean {
  const steps = parseCommandSteps(command.command);
  if (!isSingleButtonCommand(steps)) return false;

  const finalStep = steps[steps.length - 1];
  if (!finalStep || frames.length < 2) return false;

  const buttons = finalStep.tokens.filter((token) => token.kind === 'button' && !token.hold);
  if (buttons.length === 0) return false;

  return buttons.every((token) => frames[0].buttons.has(token.value) && frames[1].buttons.has(token.value));
}

function isDoubleTapDirectionCommand(steps: readonly CommandStep[]): boolean {
  return doubleTapDirectionFromSteps(steps) !== null;
}

function doubleTapDirectionCommandDirection(command: CmdCommand): DirectionToken | null {
  return doubleTapDirectionFromSteps(parseCommandSteps(command.command));
}

function doubleTapDirectionFromSteps(steps: readonly CommandStep[]): DirectionToken | null {
  if (steps.length !== 2) {
    return null;
  }

  const first = singleNonHoldDirection(steps[0]);
  const second = singleNonHoldDirection(steps[1]);
  return first !== null && first === second ? first : null;
}

function matchesCommandAtOffset(
  command: CmdCommand,
  frames: readonly InputFrame[],
  requireFinalStepAtStart = false,
): boolean {
  const steps = parseCommandSteps(command.command);
  if (steps.length === 0) {
    return false;
  }

  const timeLimit = command.time ?? 15;

  let frameIndex = 0;
  let previousMatchedFrameIndex = -1;
  const matchedFrameIndices = new Array<number>(steps.length).fill(-1);

  for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const step = steps[stepIndex];

    const allowSameFrame =
      previousMatchedFrameIndex >= 0 &&
      canShareFrame(step, steps[stepIndex + 1]) &&
      stepMatchesFrame(step, frames[previousMatchedFrameIndex]);

    if (allowSameFrame) {
      matchedFrameIndices[stepIndex] = previousMatchedFrameIndex;
      frameIndex = previousMatchedFrameIndex + 1;
      continue;
    }

    const foundIndex = findStep(
      step,
      frames,
      frameIndex,
      timeLimit,
      shouldRequireFreshDirection(step, steps[stepIndex + 1]),
      shouldRequireFreshButton(step),
      steps[stepIndex + 1],
      previousMatchedFrameIndex,
    );

    if (foundIndex < 0 || (requireFinalStepAtStart && stepIndex === steps.length - 1 && foundIndex !== 0)) {
      return false;
    }

    matchedFrameIndices[stepIndex] = foundIndex;
    previousMatchedFrameIndex = foundIndex;
    frameIndex = foundIndex + 1;
  }

  return releaseRequirementsSatisfied(steps, frames, matchedFrameIndices);
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
  const release = normalizedPart.includes('~');
  const raw = normalizedPart.replace(/[~/$]/g, '');

  if (isDirectionToken(raw)) {
    return { kind: 'direction', value: raw, hold, release };
  }

  return { kind: 'button', value: raw.toLowerCase(), hold, release };
}

function releaseRequirementsSatisfied(
  steps: readonly CommandStep[],
  frames: readonly InputFrame[],
  matchedFrameIndices: readonly number[],
): boolean {
  return steps.every((step, stepIndex) =>
    step.tokens.every((token) => {
      if (!token.release) return true;

      const matchedFrameIndex = matchedFrameIndices[stepIndex];
      for (let index = matchedFrameIndex - 1; index >= 0; index -= 1) {
        if (!frameMatchesToken(frames[index], token)) return true;
      }

      return false;
    }),
  );
}

function findStep(
  step: CommandStep,
  frames: readonly InputFrame[],
  startIndex: number,
  timeLimit: number,
  requireFreshDirection: boolean,
  requireFreshButton: boolean,
  laterStep: CommandStep | undefined,
  laterMatchedFrameIndex: number,
): number {
  const endIndex = Math.min(frames.length, timeLimit);
  for (let index = startIndex; index < endIndex; index += 1) {
    if (
      stepMatchesFrame(step, frames[index]) &&
      (!requireFreshDirection || isFreshDirectionStep(step, frames, index)) &&
      (!requireFreshButton || isFreshButtonStep(step, frames, index)) &&
      !reusesAmbiguousDiagonal(
        step,
        laterStep,
        frames,
        index,
        laterMatchedFrameIndex,
      )
    ) {
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

function shouldRequireFreshDirection(step: CommandStep, laterStep: CommandStep | undefined): boolean {
  const direction = singleNonHoldDirection(step);
  if (direction !== null && !laterStep) return true;
  const laterDirection = laterStep ? singleNonHoldDirection(laterStep) : null;
  return direction !== null && direction === laterDirection;
}

function shouldRequireFreshButton(step: CommandStep): boolean {
  return step.tokens.some((token) => token.kind === 'button' && !token.hold);
}

function isFreshDirectionStep(step: CommandStep, frames: readonly InputFrame[], index: number): boolean {
  const direction = singleNonHoldDirection(step);
  if (!direction) return true;

  const olderFrame = frames[index + 1];
  return !olderFrame || !directionContains(olderFrame.direction, direction);
}

function isFreshButtonStep(step: CommandStep, frames: readonly InputFrame[], index: number): boolean {
  const buttons = step.tokens.filter((token) => token.kind === 'button' && !token.hold);
  if (buttons.length === 0) return true;

  const olderFrame = frames[index + 1];
  return buttons.every((token) => !olderFrame?.buttons.has(token.value));
}

function reusesAmbiguousDiagonal(
  step: CommandStep,
  laterStep: CommandStep | undefined,
  frames: readonly InputFrame[],
  index: number,
  laterMatchedFrameIndex: number,
): boolean {
  if (!laterStep || laterMatchedFrameIndex < 0 || index === laterMatchedFrameIndex) return false;

  const direction = singleNonHoldDirection(step);
  const laterDirection = singleNonHoldDirection(laterStep);
  if (!direction || !laterDirection || direction === laterDirection) return false;

  const actual = frames[index]?.direction;
  const laterActual = frames[laterMatchedFrameIndex]?.direction;
  if (!actual || actual !== laterActual) return false;

  return actual !== direction && laterActual !== laterDirection;
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
