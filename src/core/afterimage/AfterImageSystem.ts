import type { PlayerState } from '../engine/types';

export type AfterImageFrame = {
  x: number;
  y: number;
  animNo: number;
  animTime: number;
  age: number;
};

export type AfterImageState = {
  enabled: boolean;
  time: number;
  frames: AfterImageFrame[];
};

export function createAfterImageState(time: number): AfterImageState {
  return {
    enabled: time > 0,
    time,
    frames: [],
  };
}

export function stepAfterImage(
  state: AfterImageState | undefined,
  player: PlayerState,
): AfterImageState | undefined {
  if (!state?.enabled) {
    return state;
  }

  const nextTime = Math.max(0, state.time - 1);

  const nextFrames = [
    {
      x: player.x,
      y: player.y,
      animNo: player.animNo,
      animTime: player.animTime,
      age: 0,
    },
    ...state.frames.map((frame) => ({ ...frame, age: frame.age + 1 })),
  ].filter((frame) => frame.age <= state.time);

  return {
    ...state,
    frames: nextFrames,
    time: nextTime,
    enabled: nextTime > 0,
  };
}

export function clearAfterImage(): AfterImageState {
  return {
    enabled: false,
    time: 0,
    frames: [],
  };
}
