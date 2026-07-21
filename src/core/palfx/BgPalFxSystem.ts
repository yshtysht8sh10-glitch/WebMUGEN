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
  return `grayscale(${grayscale}) brightness(${brightness})${state.invertAll ? ' invert(1)' : ''}`;
}
