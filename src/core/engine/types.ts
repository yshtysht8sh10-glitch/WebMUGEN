export type PlayerInput = {
  left: boolean;
  right: boolean;
  attack: boolean;
};

export type FrameInput = {
  p1: PlayerInput;
};

export type PlayerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  stateNo: number;
  stateTime: number;
  animNo: number;
  animTime: number;
};

export type GameState = {
  frame: number;
  players: [PlayerState];
};
