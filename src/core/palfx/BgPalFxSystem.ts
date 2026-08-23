import type { BgPalFxState, GameState } from '../engine/types';

export type BgPalFxEvent = Omit<BgPalFxState, 'remainingTime' | 'elapsedTime'>;

export function applyBgPalFxEvents(state: GameState, events: readonly BgPalFxEvent[]): GameState {
  if (events.length === 0) return state;
  const event = events[events.length - 1];
  return {
    ...state,
    bgPalFx: {
      ...event,
      remainingTime: event.duration,
      elapsedTime: 0,
    },
  };
}

export function stepBgPalFx(state: BgPalFxState | undefined): BgPalFxState | undefined {
  if (!state || state.duration === -1) return state;
  if (state.remainingTime <= 0) return undefined;
  return {
    ...state,
    remainingTime: state.remainingTime - 1,
    elapsedTime: state.elapsedTime + 1,
  };
}

export function resolveBgPalFxFilter(state: BgPalFxState | undefined): string {
  if (!state) return 'none';
  const average = (value: { red: number; green: number; blue: number }): number => (value.red + value.green + value.blue) / 3;
  const sinScale = state.sinAdd.period > 0
    ? Math.sin(Math.PI * 2 * state.elapsedTime / state.sinAdd.period)
    : 0;
  const additive = (average(state.add) + average(state.sinAdd) * sinScale) / 255;
  const multiplier = Math.max(0, average(state.multiply) / 256);
  const brightness = Math.max(0, multiplier + additive);
  const grayscale = Math.min(1, Math.max(0, 1 - state.color / 256));
  return `${state.invertAll ? 'invert(1) ' : ''}grayscale(${grayscale}) brightness(${brightness})`;
}

export function applyPalFxToRgba(data: Uint8ClampedArray, state: BgPalFxState | undefined): void {
  if (!state) return;
  const sinScale = state.sinAdd.period > 0
    ? Math.sin(Math.PI * 2 * state.elapsedTime / state.sinAdd.period)
    : 0;
  const color = Math.max(0, Math.min(256, state.color));
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    let red = state.invertAll ? 255 - data[index] : data[index];
    let green = state.invertAll ? 255 - data[index + 1] : data[index + 1];
    let blue = state.invertAll ? 255 - data[index + 2] : data[index + 2];
    const gray = (red + green + blue) / 3;
    red = (gray * (256 - color) + red * color) / 256;
    green = (gray * (256 - color) + green * color) / 256;
    blue = (gray * (256 - color) + blue * color) / 256;
    data[index] = red * state.multiply.red / 256 + state.add.red + state.sinAdd.red * sinScale;
    data[index + 1] = green * state.multiply.green / 256 + state.add.green + state.sinAdd.green * sinScale;
    data[index + 2] = blue * state.multiply.blue / 256 + state.add.blue + state.sinAdd.blue * sinScale;
  }
}
