import type { AfterImageState, PlayerState } from '../engine/types';

type AfterImageOptions = Omit<AfterImageState, 'enabled' | 'remainingTime' | 'captureTick' | 'frames'>;

const DEFAULT_OPTIONS: AfterImageOptions = {
  length: 20,
  timeGap: 1,
  frameGap: 4,
  transparency: 'none',
  palette: {
    color: 256,
    invertAll: false,
    bright: { red: 30, green: 30, blue: 30 },
    contrast: { red: 120, green: 120, blue: 220 },
    postBright: { red: 0, green: 0, blue: 0 },
    add: { red: 10, green: 10, blue: 25 },
    multiply: { red: 0.65, green: 0.65, blue: 0.75 },
  },
};

export function createAfterImageState(time: number, options: Partial<AfterImageOptions> = {}): AfterImageState {
  return {
    enabled: time !== 0,
    remainingTime: Math.trunc(time),
    captureTick: 0,
    length: Math.min(60, Math.max(1, Math.trunc(options.length ?? DEFAULT_OPTIONS.length))),
    timeGap: Math.max(1, Math.trunc(options.timeGap ?? DEFAULT_OPTIONS.timeGap)),
    frameGap: Math.max(1, Math.trunc(options.frameGap ?? DEFAULT_OPTIONS.frameGap)),
    transparency: options.transparency ?? DEFAULT_OPTIONS.transparency,
    palette: options.palette ?? DEFAULT_OPTIONS.palette,
    frames: [],
  };
}

export function stepAfterImage(
  state: AfterImageState | undefined,
  player: PlayerState,
): AfterImageState | undefined {
  if (!state?.enabled) return state;

  const capturing = state.remainingTime === -1 || state.remainingTime > 0;
  const shouldCapture = capturing && state.captureTick % state.timeGap === 0;
  const agedFrames = state.frames
    .map((frame) => ({ ...frame, age: frame.age + 1 }))
    .filter((frame) => frame.age < state.length * state.timeGap);
  const nextFrames = (shouldCapture ? [{
    x: player.x,
    y: player.y,
    facing: player.facing,
    animNo: player.animNo,
    animTime: player.animTime,
    age: 0,
  }, ...agedFrames] : agedFrames).slice(0, state.length);
  const nextTime = state.remainingTime === -1 ? -1 : Math.max(0, state.remainingTime - 1);

  return {
    ...state,
    frames: nextFrames,
    remainingTime: nextTime,
    captureTick: state.captureTick + 1,
    enabled: nextTime === -1 || nextTime > 0 || nextFrames.length > 0,
  };
}

export function setAfterImageTime(state: AfterImageState | undefined, time: number): AfterImageState | undefined {
  if (!state?.enabled) return state;
  if (time === 0) return clearAfterImage();
  return { ...state, remainingTime: Math.trunc(time), enabled: true };
}

export function clearAfterImage(): AfterImageState {
  return {
    enabled: false,
    remainingTime: 0,
    captureTick: 0,
    ...DEFAULT_OPTIONS,
    frames: [],
  };
}
