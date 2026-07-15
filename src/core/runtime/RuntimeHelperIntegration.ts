import type { RuntimeEvent } from './RuntimeEventQueue';
import type { HelperRuntimeState, PlayerState } from '../engine/types';
import { destroyHelper, spawnHelper } from '../helper/HelperSystem';

export function applyHelperRuntimeEvents(
  state: HelperRuntimeState,
  events: readonly RuntimeEvent[],
  players: readonly [PlayerState, PlayerState],
): HelperRuntimeState {
  return events.reduce((next, event) => {
    if (event.type === 'helper') {
      const owner = players[event.ownerId - 1];
      return spawnHelper(next, {
        helperId: event.id ?? 0,
        rootEntityId: event.ownerId,
        parentEntityId: event.ownerId,
        ownerCharacterId: event.ownerId,
        stateOwnerId: event.ownerId,
        animationOwnerId: event.ownerId,
        stateNo: event.stateNo,
        x: owner.x + event.x * owner.facing,
        y: owner.y + event.y,
        facing: owner.facing,
        keyCtrl: false,
        ownPal: false,
        spawnFrame: 0,
        parent: owner,
      });
    }

    if (event.type === 'destroyHelper') {
      const entityId = next.entries.find((helper) => helper.helperId === event.id)?.entityId;
      return entityId === undefined ? next : destroyHelper(next, entityId);
    }

    return next;
  }, state);
}
