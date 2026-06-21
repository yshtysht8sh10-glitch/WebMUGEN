import type { RuntimeEvent } from './RuntimeEventQueue';
import type { PauseState } from '../pause/PauseSystem';
import { startPause, startSuperPause } from '../pause/PauseSystem';

export function applyPauseRuntimeEvents(state: PauseState, events: readonly RuntimeEvent[]): PauseState {
  return events.reduce((next, event) => {
    if (event.type === 'pause') {
      return startPause(next, event.time, event.moveTime);
    }

    if (event.type === 'superpause') {
      return startSuperPause(next, event.time, {
        moveTime: event.moveTime,
        darken: event.darken,
      });
    }

    return next;
  }, state);
}
