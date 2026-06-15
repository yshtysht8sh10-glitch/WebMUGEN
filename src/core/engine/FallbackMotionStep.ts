import type { GameState, PlayerState } from './types';
import { clampPlayersToGround, DEFAULT_GROUND_Y } from './GroundClamp';

const GRAVITY = 0.6;
const FRICTION = 0.82;

export function stepFallbackMotion(state: GameState): GameState {
  const movedState: GameState = {
    ...state,
    players: [stepPlayerMotion(state.players[0]), stepPlayerMotion(state.players[1])],
    frame: state.frame + 1,
  };

  return clampPlayersToGround(movedState, DEFAULT_GROUND_Y);
}

function stepPlayerMotion(player: PlayerState): PlayerState {
  if ((player.hitPause ?? 0) > 0) {
    return {
      ...player,
      hitPause: Math.max(0, (player.hitPause ?? 0) - 1),
    };
  }

  const isAirborne = player.stateType === 'A' || player.physics === 'A';
  const nextVy = isAirborne ? player.vy + GRAVITY : player.vy;
  const nextX = player.x + player.vx;
  const nextY = player.y + nextVy;
  const nextVx = isAirborne ? player.vx : player.vx * FRICTION;

  return {
    ...player,
    x: nextX,
    y: nextY,
    vx: Math.abs(nextVx) < 0.01 ? 0 : nextVx,
    vy: nextVy,
    stateTime: player.stateTime + 1,
    animTime: player.animTime + 1,
  };
}
