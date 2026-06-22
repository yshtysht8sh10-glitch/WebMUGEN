export type AirFrame = {
  group: number;
  image: number;
  x: number;
  y: number;
  duration: number;
  flipH?: boolean;
  flipV?: boolean;
};

export type AirAnimation = {
  actionNo: number;
  frames: AirFrame[];
};

export type AirFrameSelection = {
  frame: AirFrame;
  frameIndex: number;
  elapsedInFrame: number;
  totalDuration: number;
};

export function getAirAnimationDuration(animation: AirAnimation): number {
  return animation.frames.reduce((total, frame) => total + normalizedDuration(frame), 0);
}

export function selectAirFrame(animation: AirAnimation, animationTime: number, loop = true): AirFrameSelection | null {
  if (animation.frames.length === 0) {
    return null;
  }

  const totalDuration = getAirAnimationDuration(animation);
  if (totalDuration <= 0) {
    return {
      frame: animation.frames[0],
      frameIndex: 0,
      elapsedInFrame: 0,
      totalDuration: 0,
    };
  }

  const time = loop ? positiveModulo(animationTime, totalDuration) : Math.min(Math.max(animationTime, 0), totalDuration - 1);
  let cursor = 0;

  for (let index = 0; index < animation.frames.length; index += 1) {
    const duration = normalizedDuration(animation.frames[index]);
    if (time < cursor + duration) {
      return {
        frame: animation.frames[index],
        frameIndex: index,
        elapsedInFrame: time - cursor,
        totalDuration,
      };
    }
    cursor += duration;
  }

  return {
    frame: animation.frames[animation.frames.length - 1],
    frameIndex: animation.frames.length - 1,
    elapsedInFrame: normalizedDuration(animation.frames[animation.frames.length - 1]) - 1,
    totalDuration,
  };
}

function normalizedDuration(frame: AirFrame): number {
  return Math.max(1, frame.duration);
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}
