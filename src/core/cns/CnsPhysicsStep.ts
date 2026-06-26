import type { GameState, PlayerState } from '../engine/types';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';

const AIR_GRAVITY = 0.6;
const GROUND_FRICTION = 0.82;

export function stepCnsPhysicsMotion(state: GameState): GameState {
  const movedPlayers = [
    stepPlayerCnsPhysics(state.players[0]),
    stepPlayerCnsPhysics(state.players[1]),
  ] as [PlayerState, PlayerState];

  return {
    ...state,
    frame: state.frame + 1,
    players: [
      clampPlayerAfterCnsPhysics(movedPlayers[0]),
      clampPlayerAfterCnsPhysics(movedPlayers[1]),
    ],
  };
}

function stepPlayerCnsPhysics(player: PlayerState): PlayerState {
  if (player.hitPause > 0) {
    return {
      ...player,
      hitPause: Math.max(0, player.hitPause - 1),
    };
  }

  const usesAirPhysics = player.physics === 'A';
  const nextVy = usesAirPhysics ? player.vy + AIR_GRAVITY : player.vy;
  const nextVx = usesAirPhysics ? player.vx : player.vx * GROUND_FRICTION;

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

function clampPlayerAfterCnsPhysics(player: PlayerState): PlayerState {
  if (player.y < DEFAULT_GROUND_Y) {
    return player;
  }

  return {
    ...player,
    y: DEFAULT_GROUND_Y,
    vy: player.physics === 'A' && player.vy > 0 ? 0 : player.vy,
  };
}
