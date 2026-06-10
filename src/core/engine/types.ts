export type PlayerInput = {
  left: boolean;
  right: boolean;
  up?: boolean;
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
  stateType: 'S' | 'C' | 'A' | 'L';
  moveType: 'I' | 'A' | 'H';
  physics: 'S' | 'C' | 'A' | 'N';
  ctrl: boolean;
  animNo: number;
  animTime: number;
};

export type GameState = {
  frame: number;
  players: [PlayerState];
};
