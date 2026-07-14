import type { FrameInput, GameState, PlayerInput, PlayerState } from './types';

const STAND = 0;
const CROUCH_START = 10;
const CROUCH = 11;
const CROUCH_END = 12;
const WALK = 20;
const JUMP_START = 40;
const JUMP_UP = 50;
const JUMP_LAND = 52;
const RUN_FWD = 100;
const HOP_BACK = 105;
const ATTACK = 200;

const GROUND_Y = 285;
const LEFT_WALL_X = 20;
const RIGHT_WALL_X = 620;
const WALK_SPEED = 2.2;
const RUN_SPEED = 4.4;
const HOP_BACK_SPEED = -3.4;
const JUMP_X_SPEED = 3.2;
const JUMP_Y_SPEED = -8.4;
const GRAVITY = 0.8;

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
    next = stepAttack(next);
  } else if (isAirState(next.stateNo)) {
    next = stepAirState(next);
  } else if (next.stateNo === JUMP_LAND) {
    next = stepJumpLand(next);
  } else if (!next.ctrl) {
    // Engine.ts is a fallback input router. It must not override a CNS StateDef
    // that has explicitly withheld control. State-local runtime/physics may still
    // advance the entity, but player input cannot force stand/walk/jump/attack.
  } else if (input.attack) {
    next = enterState({ ...next, vx: 0 }, ATTACK);
  } else if (input.down) {
    next = stepCrouchHold(next);
  } else if (isCrouchState(next.stateNo)) {
    next = enterState({ ...next, vx: 0 }, CROUCH_END);
  } else if (next.stateNo === CROUCH_END) {
    next = stepCrouchEnd(next);
  } else if (commandActive(input, 'FF')) {
    next = enterState({ ...next, vx: RUN_SPEED }, RUN_FWD);
  } else if (commandActive(input, 'BB')) {
    next = enterState({ ...next, vx: HOP_BACK_SPEED }, HOP_BACK);
  } else if (input.up) {
    next = enterState({ ...next, vx: jumpVelocityX(input), vy: JUMP_Y_SPEED }, JUMP_START);
  } else if (input.left || input.right) {
    next = stepWalk(next, input);
  } else {
    next = enterState({ ...next, vx: 0 }, STAND);
  }

  next = applyMovement(next);

  return {
    ...next,
    stateTime: next.stateTime + 1,
    animTime: next.animTime + 1,
  };
}

function stepAttack(player: PlayerState): PlayerState {
  if (player.stateTime >= 18) {
    return enterState({ ...player, vx: 0 }, STAND);
  }

  return { ...player, vx: 0 };
}

function stepAirState(player: PlayerState): PlayerState {
  if (player.stateNo === JUMP_START && player.stateTime > 0) {
    return enterState(player, JUMP_UP);
  }

  const falling = player.vy >= 0;
  if (falling && player.y >= GROUND_Y) {
    return enterState({ ...player, y: GROUND_Y, vx: 0, vy: 0 }, JUMP_LAND);
  }

  return { ...player, vy: player.vy + GRAVITY, stateType: 'A', physics: 'A', ctrl: true };
}

function stepJumpLand(player: PlayerState): PlayerState {
  if (player.stateTime >= 3) {
    return enterState({ ...player, x: player.x, y: GROUND_Y, vx: 0, vy: 0 }, STAND);
  }

  return { ...player, y: GROUND_Y, vx: 0, vy: 0, stateType: 'S', physics: 'S', ctrl: false };
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

function stepCrouchEnd(player: PlayerState): PlayerState {
  if (player.stateTime >= 6) {
    return enterState({ ...player, vx: 0 }, STAND);
  }

  return { ...player, vx: 0, stateType: 'S', physics: 'S' };
}

function stepWalk(player: PlayerState, input: PlayerInput): PlayerState {
  const vx = input.left ? -WALK_SPEED : WALK_SPEED;
  const facing: PlayerState['facing'] = input.left ? -1 : 1;
  return { ...enterState(player, WALK), facing, vx };
}

function applyMovement(player: PlayerState): PlayerState {
  const x = Math.max(LEFT_WALL_X, Math.min(RIGHT_WALL_X, player.x + player.vx));
  const y = Math.min(GROUND_Y, player.y + player.vy);
  return { ...player, x, y };
}

function jumpVelocityX(input: PlayerInput): number {
  if (input.left) return -JUMP_X_SPEED;
  if (input.right) return JUMP_X_SPEED;
  return 0;
}

function commandActive(input: PlayerInput, commandName: string): boolean {
  const expected = commandName.toLowerCase();
  if (!input.commandNames) return false;

  for (const activeCommandName of input.commandNames) {
    if (activeCommandName.toLowerCase() === expected) return true;
  }

  return false;
}

function isCrouchState(stateNo: number): boolean {
  return stateNo === CROUCH_START || stateNo === CROUCH;
}

function isAirState(stateNo: number): boolean {
  return stateNo === JUMP_START || stateNo === JUMP_UP;
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
  if (stateNo === JUMP_START || stateNo === JUMP_UP) return 'A';
  if (stateNo === CROUCH_END || stateNo === STAND || stateNo === WALK || stateNo === JUMP_LAND || stateNo === RUN_FWD || stateNo === HOP_BACK) return 'S';
  return current;
}

function physicsForState(stateNo: number, current: PlayerState['physics']): PlayerState['physics'] {
  if (stateNo === CROUCH_START || stateNo === CROUCH) return 'C';
  if (stateNo === JUMP_START || stateNo === JUMP_UP) return 'A';
  if (stateNo === CROUCH_END || stateNo === STAND || stateNo === WALK || stateNo === JUMP_LAND || stateNo === RUN_FWD || stateNo === HOP_BACK) return 'S';
  return current;
}

function ctrlForState(stateNo: number, current: boolean): boolean {
  if (stateNo === ATTACK || stateNo === JUMP_LAND) return false;
  if (stateNo === STAND || stateNo === CROUCH || stateNo === WALK || stateNo === RUN_FWD || stateNo === HOP_BACK || stateNo === JUMP_UP) return true;
  return current;
}
