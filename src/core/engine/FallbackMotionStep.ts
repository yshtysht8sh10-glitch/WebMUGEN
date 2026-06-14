import type { GameState, PlayerState } from './types';

const GROUND_Y = 360;
const GRAVITY = 0.6;
const FRICTION = 0.82;

export function stepFallbackMotion(state: GameState): GameState {
  return {
    ...state,
    frame: state.frame + 1,
    players: state.players.map(stepPlayerFallbackMotion) as [PlayerState, PlayerState],
  };
}

function stepPlayerFallbackMotion(player: PlayerState): PlayerState {
  const nextAnimTime = player.animTime + 1;
  const nextStateTime = player.stateTime + 1;

  if (player.hitPause > 0) {
    return {
      ...player,
      hitPause: player.hitPause - 1,
      animTime: nextAnimTime,
      stateTime: nextStateTime,
    };
  }

  let nextX = player.x + player.vx;
  let nextY = player.y + player.vy;
  let nextVx = player.vx;
  let nextVy = player.vy;
  let nextStateType = player.stateType;
  let nextPhysics = player.physics;

  if (player.physics === 'A' || player.stateType === 'A') {
    nextVy += GRAVITY;
  } else if (player.physics === 'S' || player.physics === 'C') {
    nextVx *= FRICTION;
  }

  if (nextY >= GROUND_Y) {
    nextY = GROUND_Y;

    if (nextStateType === 'A') {
      nextVy = 0;
      nextStateType = 'S';
      nextPhysics = 'S';
    }
  }

  return {
    ...player,
    x: nextX,
    y: nextY,
    vx: Math.abs(nextVx) < 0.01 ? 0 : nextVx,
    vy: Math.abs(nextVy) < 0.01 ? 0 : nextVy,
    stateType: nextStateType,
    physics: nextPhysics,
    animTime: nextAnimTime,
    stateTime: nextStateTime,
  };
}
