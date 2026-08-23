import type { PlayerState } from '../engine/types';

export type TargetEntry = NonNullable<PlayerState['targets']>[number];

export function registerTarget(
  player: PlayerState,
  target: PlayerState,
  activeHitDefId: number,
  hitDefId: number,
): PlayerState {
  if (target.life <= 0) return removeTarget(player, target.id);
  const retained = (player.targets ?? []).filter((entry) => entry.playerId !== target.id);
  return { ...player, targets: [...retained, { playerId: target.id, hitDefId, activeHitDefId }] };
}

export function removeTarget(player: PlayerState, playerId: number): PlayerState {
  return { ...player, targets: (player.targets ?? []).filter((entry) => entry.playerId !== playerId) };
}

export function pruneTargets(player: PlayerState, players: readonly PlayerState[]): PlayerState {
  const existingIds = new Set(players.map((candidate) => candidate.id));
  // WinMUGEN keeps an already-acquired Target selectable after lethal damage.
  // Custom KO sequences can still need a later TargetState to release P2.
  return { ...player, targets: (player.targets ?? []).filter((entry) => existingIds.has(entry.playerId as 1 | 2)) };
}

export function selectTargets(player: PlayerState, hitDefId?: number): TargetEntry[] {
  return (player.targets ?? []).filter((entry) => hitDefId === undefined || entry.hitDefId === hitDefId);
}
