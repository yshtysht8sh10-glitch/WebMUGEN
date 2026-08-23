import type { AfterImageState, PlayerState } from '../engine/types';
import { getPresentedAnimationTime } from '../animation/PresentedAnimation';

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
    animTime: getPresentedAnimationTime(player),
    drawAngle: player.drawAngle,
    drawScale: player.drawScale,
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
  return { ...state, remainingTime: Math.trunc(time), enabled: true };
}

export function applyAfterImagePaletteToRgba(
  data: Uint8ClampedArray,
  palette: AfterImageState['palette'],
  historyIndex: number,
): void {
  const color = clamp(palette.color, 0, 256);
  const repetitions = Math.max(0, Math.trunc(historyIndex));
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    const sourceRed = data[index];
    const sourceGreen = data[index + 1];
    const sourceBlue = data[index + 2];
    const gray = (sourceRed + sourceGreen + sourceBlue) / 3;
    let red = mixColor(gray, sourceRed, color);
    let green = mixColor(gray, sourceGreen, color);
    let blue = mixColor(gray, sourceBlue, color);
    if (palette.invertAll) {
      red = 255 - red;
      green = 255 - green;
      blue = 255 - blue;
    }
    red = applyBasePalette(red, palette.bright.red, palette.contrast.red, palette.postBright.red);
    green = applyBasePalette(green, palette.bright.green, palette.contrast.green, palette.postBright.green);
    blue = applyBasePalette(blue, palette.bright.blue, palette.contrast.blue, palette.postBright.blue);
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      red = clamp((red + palette.add.red) * palette.multiply.red, 0, 255);
      green = clamp((green + palette.add.green) * palette.multiply.green, 0, 255);
      blue = clamp((blue + palette.add.blue) * palette.multiply.blue, 0, 255);
    }
    data[index] = red;
    data[index + 1] = green;
    data[index + 2] = blue;
  }
}

function mixColor(gray: number, channel: number, color: number): number {
  return (gray * (256 - color) + channel * color) / 256;
}

function applyBasePalette(channel: number, bright: number, contrast: number, postBright: number): number {
  return clamp((channel + bright) * contrast / 256 + postBright, 0, 255);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
