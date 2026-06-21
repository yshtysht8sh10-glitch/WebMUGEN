import type { RuntimeEvent } from './RuntimeEventQueue';
import type { HelperState } from '../helper/HelperSystem';
import type { PlayerState } from '../engine/types';
import { destroyHelper, spawnHelper } from '../helper/HelperSystem';

export function applyHelperRuntimeEvents(
  state: HelperState,
  events: readonly RuntimeEvent[],
  players: readonly [PlayerState, PlayerState],
): HelperState {
  return events.reduce((next, event) => {
    if (event.type === 'helper') {
      const owner = players[event.ownerId - 1];
      return spawnHelper(next, owner, event.ownerId, {
        id: event.id ?? undefined,
        stateNo: event.stateNo,
        x: event.x,
        y: event.y,
        lifeTime: event.lifeTime,
      });
    }

    if (event.type === 'destroyHelper') {
      return destroyHelper(next, event.id);
    }

    return next;
  }, state);
}
