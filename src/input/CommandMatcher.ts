import type { CmdCommand } from '../parser/cmd/CmdTypes';
import type { DirectionToken, InputFrame } from './InputBuffer';

export type CommandToken =
  | { kind: 'direction'; value: DirectionToken; hold: boolean }
  | { kind: 'button'; value: string; hold: boolean };

export function parseCommandTokens(command: string): CommandToken[] {
  return command
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .flatMap(parseCommandPart);
}

export function matchesCommand(command: CmdCommand, frames: readonly InputFrame[]): boolean {
  const tokens = parseCommandTokens(command.command);
  if (tokens.length === 0) {
    return false;
  }

  const timeLimit = command.time ?? 15;
  const searchFrames = frames.slice(0, timeLimit);

  let frameIndex = 0;

  for (let tokenIndex = tokens.length - 1; tokenIndex >= 0; tokenIndex -= 1) {
    const token = tokens[tokenIndex];
    const foundIndex = findToken(token, searchFrames, frameIndex);

    if (foundIndex < 0) {
      return false;
    }

    frameIndex = foundIndex + 1;
  }

  return true;
}

function parseCommandPart(part: string): CommandToken[] {
  if (part.includes('+')) {
    return part.split('+').flatMap((piece) => parseCommandPart(piece.trim()));
  }

  const hold = part.startsWith('/');
  const raw = hold ? part.slice(1) : part;
  const normalized = raw.toUpperCase();

  if (isDirectionToken(normalized)) {
    return [{ kind: 'direction', value: normalized, hold }];
  }

  return [{ kind: 'button', value: raw.toLowerCase(), hold }];
}

function findToken(
  token: CommandToken,
  frames: readonly InputFrame[],
  startIndex: number,
): number {
  for (let index = startIndex; index < frames.length; index += 1) {
    if (frameMatchesToken(frames[index], token)) {
      return index;
    }

    if (token.hold) {
      break;
    }
  }

  return -1;
}

function frameMatchesToken(frame: InputFrame, token: CommandToken): boolean {
  if (token.kind === 'direction') {
    if (token.hold) {
      return directionContains(frame.direction, token.value);
    }

    return frame.direction === token.value;
  }

  return frame.buttons.has(token.value);
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
