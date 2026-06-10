import type { InputBuffer } from '../../input/InputBuffer';

export type PlayerInput = {
  left: boolean;
  right: boolean;
  up?: boolean;
  down?: boolean;
  attack: boolean;
  commandNames?: Set<string>;
  inputBuffer?: InputBuffer;
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

export type ActiveHitDef = {
  damage: number;
  guardDamage: number;
  pauseTime: {
    attacker: number;
    defender: number;
  };
  groundVelocity: {
    x: number;
    y: number;
  };
  airVelocity: {
    x: number;
    y: number;
  };
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
  activeHitDef: ActiveHitDef | null;
  hitDefUsed: boolean;
};

export type ProjectileState = {
  id: number;
  ownerId: 1 | 2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  animNo: number;
  animTime: number;
  lifeTime: number;
  removeTime: number;
  hitDef: ActiveHitDef;
  hitBox: Rect;
};

export type HitEvent = {
  attackerId: 1 | 2;
  defenderId: 1 | 2;
  damage: number;
};

export type GameState = {
  frame: number;
  players: [PlayerState, PlayerState];
  projectiles: ProjectileState[];
  hitEvents: HitEvent[];
};
