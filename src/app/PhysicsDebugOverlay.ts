import type { GameState, PlayerState } from '../core/engine/types';

export function formatPhysicsDebugOverlay(state: GameState): string[] {
  return [
    formatPlayerPhysicsDebug('p1', state.players[0]),
    formatPlayerPhysicsDebug('p2', state.players[1]),
  ];
}

function formatPlayerPhysicsDebug(label: string, player: PlayerState): string {
  return [
    `phys ${label}`,
    `state=${player.stateNo}`,
    `type=${player.stateType}`,
    `physics=${player.physics}`,
    `ctrl=${player.ctrl ? 1 : 0}`,
    `facing=${player.facing}`,
    `power=${readPower(player)}`,
    `juggle=${readJuggle(player)}`,
    `juggleRemaining=${player.juggleRemaining ?? '-'}/${player.juggleMax ?? '-'}`,
    `guard=${player.guardIntent ? 'back' : '-'}${player.guardCrouchIntent ? '+down' : ''}`,
    `owner=${player.stateOwnerId ?? player.id}/${player.selfStateOwnerId ?? player.id}`,
    `pos=(${formatNumber(player.x)},${formatNumber(player.y)})`,
    `vel=(${formatNumber(player.vx)},${formatNumber(player.vy)})`,
    `time=${player.stateTime}`,
    `anim=${player.animNo}:${player.animTime}`,
  ].join(' ');
}

function readPower(player: PlayerState): number {
  return (player as PlayerState & { power?: number }).power ?? 0;
}

function readJuggle(player: PlayerState): string {
  const value = player.juggle;
  return value === undefined ? '-' : String(value);
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2);
}
