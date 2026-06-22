import { snapshotToTokens, type InputFrame, type InputSnapshot, type InputToken } from './InputTypes';

export type InputBuffer = {
  maxFrames: number;
  frames: InputFrame[];
};

export function createInputBuffer(maxFrames = 60): InputBuffer {
  return { maxFrames, frames: [] };
}

export function pushInputFrame(buffer: InputBuffer, frame: number, snapshot: InputSnapshot): InputBuffer {
  const nextFrames = [
    ...buffer.frames.filter((entry) => entry.frame !== frame),
    { frame, tokens: snapshotToTokens(snapshot) },
  ]
    .sort((a, b) => a.frame - b.frame)
    .filter((entry) => entry.frame > frame - buffer.maxFrames);

  return {
    ...buffer,
    frames: nextFrames,
  };
}

export function getRecentInputFrames(buffer: InputBuffer, currentFrame: number, windowFrames: number): InputFrame[] {
  return buffer.frames.filter((entry) => entry.frame <= currentFrame && entry.frame > currentFrame - windowFrames);
}

export function hasTokenAtFrame(buffer: InputBuffer, frame: number, token: InputToken): boolean {
  return buffer.frames.find((entry) => entry.frame === frame)?.tokens.includes(token) ?? false;
}
