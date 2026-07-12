import type { PlayerState } from '../engine/types';

export type MoveContactResult = 'hit' | 'guarded';

export function activateMoveContact(player: PlayerState, activeHitDefId: number): PlayerState {
  if (player.moveContact?.activeHitDefId === activeHitDefId) return player;
  return {
    ...player,
    moveContact: {
      activeHitDefId,
      contact: false,
      hit: false,
      guarded: false,
      hitCount: player.moveContact?.hitCount ?? 0,
    },
  };
}

export function recordMoveContact(player: PlayerState, activeHitDefId: number, result: MoveContactResult): PlayerState {
  const activated = activateMoveContact(player, activeHitDefId);
  const current = activated.moveContact!;
  return {
    ...activated,
    moveContact: {
      ...current,
      contact: true,
      hit: result === 'hit',
      guarded: result === 'guarded',
      hitCount: current.hitCount + (result === 'hit' ? 1 : 0),
    },
  };
}

export function resetMoveContact(player: PlayerState): PlayerState {
  if (!player.moveContact) return player;
  return {
    ...player,
    moveContact: { ...player.moveContact, contact: false, hit: false, guarded: false },
  };
}
