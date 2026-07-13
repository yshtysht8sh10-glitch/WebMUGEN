import type { GameState } from '../engine/types';
import { applyExplodCreateEvents, type ExplodCreateEvent } from '../explod/ExplodSystem';

/** @deprecated Production code applies Explod events directly in the game coordinator. */
export function applyExplodRuntimeEvents(state: GameState, events: readonly ExplodCreateEvent[]): GameState {
  return applyExplodCreateEvents(state, events);
}
