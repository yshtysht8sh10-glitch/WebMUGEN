import type { GameState, PlayerState } from './types';

export const DEFAULT_GROUND_Y = 285;

export function clampPlayersToGround(
  state: GameState,
  groundY: number = DEFAULT_GROUND_Y,
): GameState {
  return {
    ...state,
    players: [
      clampPlayerToGround(state.players[0], groundY),
      clampPlayerToGround(state.players[1], groundY),
    ],
  };
}

export function clampPlayerToGround(player: PlayerState, groundY: number = DEFAULT_GROUND_Y): PlayerState {
  if (player.y < groundY) {
    return player;
  }

  // Air get-hit common states detect landing from Pos Y/Vel Y and choose
  // recover, fall, or down routes themselves. Clamping here would erase that
  // observable crossing before the CNS controllers can evaluate it.
  if ((player.stateType === 'A' || player.stateType === 'L') && player.moveType === 'H') {
    return player;
  }

  const landedFromAir = player.stateType === 'A' || player.physics === 'A' || player.vy > 0;

  return {
    ...player,
    y: groundY,
    vy: 0,
    stateType: landedFromAir ? 'S' : player.stateType,
    physics: landedFromAir ? 'S' : player.physics,
    ctrl: landedFromAir ? true : player.ctrl,
  };
}
