import type { GameState, PlayerState } from '../engine/types';
import { clampPlayersToGround, DEFAULT_GROUND_Y } from '../engine/GroundClamp';

const AIR_GRAVITY = 0.6;
const GROUND_FRICTION = 0.82;

export function stepCnsPhysicsMotion(state: GameState): GameState {
  const movedState: GameState = {
    ...state,
    frame: state.frame + 1,
    players: [stepPlayerCnsPhysics(state.players[0]), stepPlayerCnsPhysics(state.players[1])],
  };

  return clampPlayersToGround(movedState, DEFAULT_GROUND_Y);
}

function stepPlayerCnsPhysics(player: PlayerState): PlayerState {
  if (player.hitPause > 0) {
    return {
      ...player,
      hitPause: Math.max(0, player.hitPause - 1),
    };
  }

  const airborne = player.stateType === 'A' || player.physics === 'A';
  const nextVy = airborne ? player.vy + AIR_GRAVITY : player.vy;
  const nextVx = airborne ? player.vx : player.vx * GROUND_FRICTION;

  return {
    ...player,
    x: player.x + player.vx,
    y: player.y + nextVy,
    vx: Math.abs(nextVx) < 0.01 ? 0 : nextVx,
    vy: nextVy,
    stateTime: player.stateTime + 1,
    animTime: player.animTime + 1,
  };
}
