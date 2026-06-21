import type { RuntimeEvent } from './RuntimeEventQueue';
import type { ExplodState } from '../explod/ExplodSystem';
import { addExplod, removeExplod } from '../explod/ExplodSystem';

export function applyExplodRuntimeEvents(
  state: ExplodState,
  events: readonly RuntimeEvent[],
  owner: { x: number; y: number; facing: 1 | -1 },
): ExplodState {
  return events.reduce((next, event) => {
    if (event.type === 'explod') {
      return addExplod(next, {
        id: event.id ?? undefined,
        animNo: event.animNo,
        x: owner.x + event.x,
        y: owner.y + event.y,
        facing: owner.facing,
        removeTime: event.removeTime,
      });
    }

    if (event.type === 'removeExplod') {
      return removeExplod(next, event.id);
    }

    return next;
  }, state);
}
