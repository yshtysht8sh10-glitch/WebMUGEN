export type PlayerInput = {
  left: boolean;
  right: boolean;
  up?: boolean;
  attack: boolean;
};

export type FrameInput = {
  p1: PlayerInput;
  p2?: PlayerInput;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PlayerState = {
  id: 1 | 2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  life: number;
  stateNo: number;
  stateTime: number;
  stateType: 'S' | 'C' | 'A' | 'L';
  moveType: 'I' | 'A' | 'H';
  physics: 'S' | 'C' | 'A' | 'N';
  ctrl: boolean;
  animNo: number;
  animTime: number;
  hitPause: number;
};

export type HitEvent = {
  attackerId: 1 | 2;
  defenderId: 1 | 2;
  damage: number;
};

export type GameState = {
  frame: number;
  players: [PlayerState, PlayerState];
  hitEvents: HitEvent[];
};
