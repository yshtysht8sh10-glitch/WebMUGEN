import type { InputBuffer } from '../../input/InputBuffer';

export type PlayerInput = {
  left: boolean;
  right: boolean;
  up?: boolean;
  down?: boolean;
  attack: boolean;
  buttons?: ReadonlySet<string> | readonly string[];
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
  diagnosticId?: number;
  controllerKey?: string;
  damageValues?: [number, number];
  damageSource?: 'cns' | 'existing_fallback';
  missLogged?: boolean;
  rejectedLogged?: boolean;
  duplicateLogged?: boolean;
  groundHitTime?: number;
  airHitTime?: number;
  groundHitTimeSource?: 'cns' | 'hardcoded';
  airHitTimeSource?: 'cns' | 'hardcoded';
  groundHitTimeFallbackReason?: string;
  airHitTimeFallbackReason?: string;
  animType?: 'Light' | 'Medium' | 'Hard';
  groundAnimTypeRaw?: string;
  animTypeSource?: 'cns' | 'existing_fallback';
  snapshotSignature?: string;
  attr?: { stateType: string; attackTypes: string[] };
  airAnimType?: string;
  fallAnimType?: string;
  hitFlag?: string;
  guardFlag?: string;
  priority?: { value: number; type?: string };
  guardPauseTime?: { attacker: number; defender: number };
  groundType?: string;
  airType?: string;
  guardHitTime?: number;
  groundSlideTime?: number;
  controlTime?: number;
  yAcceleration?: number;
  guardVelocity?: { x: number; y: number };
  fall?: {
    enabled?: boolean;
    animType?: string;
    xVelocity?: number;
    yVelocity?: number;
    recover?: boolean;
    recoverTime?: number;
    damage?: number;
    kill?: boolean;
  };
  hitId?: number;
  chainId?: number;
  noChainIds?: number[];
  unappliedParameters?: string[];
  invalidParameters?: string[];
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
  hitTargets?: Array<{ activeHitDefId: number; defenderId: number }>;
  getHitVars?: Record<string, number>;
  getHitVarUnsupportedKeys?: string[];
  moveContact?: {
    activeHitDefId: number;
    contact: boolean;
    hit: boolean;
    guarded: boolean;
    hitCount: number;
  };
  targets?: Array<{
    playerId: number;
    hitDefId: number;
    activeHitDefId: number;
  }>;
  playerPush?: boolean;
  hitDiagnosticLines?: string[];
  hitStun?: {
    activeHitDefId: number | null;
    selectedHitTime: number;
    kind: 'ground' | 'air' | 'fallback';
    source: 'active_hitdef' | 'hardcoded';
    targetStateTypeAtHit: PlayerState['stateType'];
    fallbackReason?: string;
    elapsed: number;
    lastStateNo: number;
    blockedEvents?: string[];
    selectedAnim?: number;
  };
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
  hitDiagnosticLines?: string[];
  commandBuffers?: [InputBuffer, InputBuffer];
  commandNames?: [ReadonlySet<string>, ReadonlySet<string>];
};
