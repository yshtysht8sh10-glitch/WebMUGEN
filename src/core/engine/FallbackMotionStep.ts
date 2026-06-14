import type { GameState, PlayerState } from './types';

const GROUND_Y = 285;
const GRAVITY = 0.55;
const FRICTION = 0.78;

export function stepFallbackMotion(state: GameState): GameState {
  return {
    ...state,
    frame: state.frame + 1,
    players: [
      stepFallbackPlayer(state.players[0]),
      stepFallbackPlayer(state.players[1]),
    ],
    projectiles: state.projectiles,
    hitEvents: [],
  };
}

function stepFallbackPlayer(player: PlayerState): PlayerState {
  let next: PlayerState = {
    ...player,
    stateTime: player.stateTime + 1,
    animTime: player.animTime + 1,
    hitPause: Math.max(0, player.hitPause - 1),
  };

  if (next.hitPause > 0) {
    return next;
  }

  next = {
    ...next,
    x: next.x + next.vx,
    y: next.y + next.vy,
  };

  if (next.stateType === 'A' || next.physics === 'A') {
    next = {
      ...next,
      vy: next.vy + GRAVITY,
    };

    if (next.y >= GROUND_Y) {
      next = {
        ...next,
        y: GROUND_Y,
        vy: 0,
        vx: 0,
        stateNo: 0,
        animNo: 0,
        animTime: 0,
        stateTime: 0,
        stateType: 'S',
        moveType: 'I',
        physics: 'S',
        ctrl: true,
      };
    }
  } else {
    next = {
      ...next,
      vx: Math.abs(next.vx) < 0.05 ? 0 : next.vx * FRICTION,
      y: GROUND_Y,
      vy: 0,
    };
  }

  if (isActionFinished(next)) {
    next = {
      ...next,
      stateNo: 0,
      animNo: 0,
      animTime: 0,
      stateTime: 0,
      moveType: 'I',
      ctrl: true,
      vx: 0,
    };
  }

  return next;
}

function isActionFinished(player: PlayerState): boolean {
  if (player.stateNo === 200) return player.stateTime > 18;
  if (player.stateNo === 1000) return player.stateTime > 28;
  return false;
}
