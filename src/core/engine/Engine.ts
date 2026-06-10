import type { FrameInput, GameState, PlayerState } from './types';

const STAND = 0;
const WALK = 20;
const ATTACK = 200;

export function stepGame(current: GameState, input: FrameInput): GameState {
  const player = stepPlayer(current.players[0], input);

  return {
    frame: current.frame + 1,
    players: [player],
  };
}

function stepPlayer(current: PlayerState, input: FrameInput): PlayerState {
  const p1 = input.p1;
  let next: PlayerState = { ...current };

  if (next.stateNo === ATTACK) {
    next.vx = 0;

    if (next.stateTime >= 18) {
      next = enterState(next, STAND);
    }
  } else if (p1.attack) {
    next = enterState(next, ATTACK);
  } else if (p1.left || p1.right) {
    next = enterState(next, WALK);
    next.facing = p1.left ? -1 : 1;
    next.vx = p1.left ? -2.2 : 2.2;
  } else {
    next = enterState(next, STAND);
    next.vx = 0;
  }

  next.x += next.vx;
  next.y += next.vy;
  next.x = Math.max(20, Math.min(620, next.x));

  return {
    ...next,
    stateTime: next.stateTime + 1,
    animTime: next.animTime + 1,
  };
}

function enterState(player: PlayerState, stateNo: number): PlayerState {
  if (player.stateNo === stateNo) {
    return player;
  }

  return {
    ...player,
    stateNo,
    stateTime: 0,
    animNo: stateNo,
    animTime: 0,
  };
}
