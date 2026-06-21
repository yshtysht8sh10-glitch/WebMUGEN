import { setActiveHitDef, type ActiveHitDefStore } from '../hitdef/ActiveHitDefStore';
import { isHitDefRuntimeEvent, type RuntimeHitDefEvent } from './RuntimeHitDefEvents';
import type { RuntimeEvent } from './RuntimeEventQueue';

export function applyHitDefRuntimeEvents(
  store: ActiveHitDefStore,
  events: readonly (RuntimeEvent | RuntimeHitDefEvent)[],
  frame: number,
): ActiveHitDefStore {
  return events.reduce((next, event) => {
    if (!isHitDefRuntimeEvent(event)) {
      return next;
    }

    return setActiveHitDef(next, event.ownerId, event.hitDef, frame);
  }, store);
}
