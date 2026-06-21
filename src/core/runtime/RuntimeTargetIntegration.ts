import type { RuntimeEvent } from './RuntimeEventQueue';
import type { TargetState } from '../target/TargetSystem';
import { addTarget, dropTargets } from '../target/TargetSystem';

export function applyTargetRuntimeEvents(state: TargetState, events: readonly RuntimeEvent[]): TargetState {
  return events.reduce((next, event) => {
    if (event.type === 'targetBind') {
      return addTarget(next, event.ownerId, event.targetId, event.time);
    }

    if (event.type === 'targetDrop') {
      return dropTargets(next, event.ownerId);
    }

    return next;
  }, state);
}
