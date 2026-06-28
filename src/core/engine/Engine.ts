import type { FrameInput, GameState, PlayerInput, PlayerState } from './types';

const STAND = 0;
const CROUCH_START = 10;
const CROUCH = 11;
const CROUCH_END = 12;
const WALK = 20;
const ATTACK = 200;

export function stepGame(current: GameState, input: FrameInput): GameState {
  const p1 = stepPlayer(current.players[0], input.p1);
  const p2 = current.players[1];

  return {
    ...current,
    frame: current.frame + 1,
    players: [p1, p2],
  };
}

function stepPlayer(current: PlayerState, input: PlayerInput): PlayerState {
  let next: PlayerState = { ...current };

  if (next.stateNo === ATTACK) {
    next.vx = 0;

    if (next.stateTime >= 18) {
      next = enterState(next, STAND);
    }
  } else if (input.attack) {
    next = enterState(next, ATTACK);
  } else if (input.down) {
    next = stepCrouchHold(next);
  } else if (isCrouchState(next.stateNo)) {
    next = enterState(next, CROUCH_END);
    next.vx = 0;
  } else if (next.stateNo === CROUCH_END) {
    next.vx = 0;

    if (next.stateTime >= 6) {
      next = enterState(next, STAND);
    }
  } else if (input.left || input.right) {
    next = enterState(next, WALK);
    next.facing = input.left ? -1 : 1;
    next.vx = input.left ? -2.2 : 2.2;
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

function stepCrouchHold(player: PlayerState): PlayerState {
  if (player.stateNo === CROUCH_START && player.stateTime > 0) {
    return enterState({ ...player, vx: 0 }, CROUCH);
  }

  if (player.stateNo === CROUCH_START || player.stateNo === CROUCH) {
    return { ...player, vx: 0, stateType: 'C', physics: 'C', ctrl: true };
  }

  return enterState({ ...player, vx: 0 }, CROUCH_START);
}

function isCrouchState(stateNo: number): boolean {
  return stateNo === CROUCH_START || stateNo === CROUCH;
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
    stateType: stateTypeForState(stateNo, player.stateType),
    physics: physicsForState(stateNo, player.physics),
    ctrl: ctrlForState(stateNo, player.ctrl),
  };
}

function stateTypeForState(stateNo: number, current: PlayerState['stateType']): PlayerState['stateType'] {
  if (stateNo === CROUCH_START || stateNo === CROUCH) return 'C';
  if (stateNo === CROUCH_END || stateNo === STAND || stateNo === WALK) return 'S';
  return current;
}

function physicsForState(stateNo: number, current: PlayerState['physics']): PlayerState['physics'] {
  if (stateNo === CROUCH_START || stateNo === CROUCH) return 'C';
  if (stateNo === CROUCH_END || stateNo === STAND || stateNo === WALK) return 'S';
  return current;
}

function ctrlForState(stateNo: number, current: boolean): boolean {
  if (stateNo === ATTACK) return false;
  if (stateNo === STAND || stateNo === CROUCH || stateNo === WALK) return true;
  return current;
}
