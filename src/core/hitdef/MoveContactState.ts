import type { PlayerState } from '../engine/types';

export type MoveContactResult = 'hit' | 'guarded';

export function activateMoveContact(player: PlayerState, activeHitDefId: number): PlayerState {
  if (player.moveContact?.activeHitDefId === activeHitDefId) return player;
  const current = player.moveContact;
  return {
    ...player,
    moveContact: {
      activeHitDefId,
      contact: current?.contact ?? false,
      hit: current?.hit ?? false,
      guarded: current?.guarded ?? false,
      elapsed: current?.elapsed ?? (current?.contact ? 1 : 0),
      hitCount: current?.hitCount ?? 0,
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
      elapsed: 1,
      hitCount: current.hitCount + (result === 'hit' ? 1 : 0),
    },
  };
}

export function advanceMoveContact(player: PlayerState): PlayerState {
  if (!player.moveContact?.contact) return player;
  return {
    ...player,
    moveContact: {
      ...player.moveContact,
      elapsed: Math.max(1, player.moveContact.elapsed ?? 1) + 1,
    },
  };
}

export function resetMoveContact(player: PlayerState): PlayerState {
  if (!player.moveContact) return player;
  return {
    ...player,
    moveContact: { ...player.moveContact, contact: false, hit: false, guarded: false, elapsed: 0 },
  };
}
