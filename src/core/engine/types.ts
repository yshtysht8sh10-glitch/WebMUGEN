import type { InputBuffer } from '../../input/InputBuffer';
import type { ExplodRuntimeState } from '../explod/ExplodSystem';
import type { PauseState } from '../pause/PauseSystem';

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
  guardDistance?: number;
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
  guardKill?: boolean;
  kill?: boolean;
  getPower?: { hit: number; guarded: number };
  givePower?: { hit: number; guarded: number };
  numHits?: number;
  cornerPush?: {
    ground?: number;
    air?: number;
    down?: number;
    guard?: number;
    airGuard?: number;
  };
  snap?: { x: number; y: number };
  p1SprPriority?: number;
  p2SprPriority?: number;
  p1StateNo?: number;
  p2StateNo?: number;
  p2GetP1State?: boolean;
  forceStand?: boolean;
  spark?: { animNo: number; scope: 'common' | 'attacker' };
  guardSpark?: { animNo: number; scope: 'common' | 'attacker' };
  sparkOffset?: { x: number; y: number };
  hitSound?: { group: number; index: number; scope: 'common' | 'attacker' };
  guardSound?: { group: number; index: number; scope: 'common' | 'attacker' };
  envShake?: { time: number; frequency: number; amplitude: number; phase: number };
  hitOnce?: boolean;
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
  downVelocity?: { x: number; y: number };
  downHitTime?: number;
};

export type PlayerState = {
  id: 1 | 2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  life: number;
  power?: number;
  sprPriority?: number;
  comboHitCount?: number;
  stateNo: number;
  stateTime: number;
  stateType: 'S' | 'C' | 'A' | 'L';
  moveType: 'I' | 'A' | 'H';
  physics: 'S' | 'C' | 'A' | 'N';
  ctrl: boolean;
  animNo: number;
  animTime: number;
  hitPause: number;
  pauseControllerLatch?: { key: string; stateNo: number; stateTime: number };
  activeHitDef: ActiveHitDef | null;
  hitDefUsed: boolean;
  hitTargets?: Array<{ activeHitDefId: number; defenderId: number; hitDefId?: number }>;
  lastHitDefByAttacker?: Record<number, number>;
  lastHitAttackerId?: number;
  getHitVars?: Record<string, number>;
  getHitVarUnsupportedKeys?: string[];
  hitFall?: boolean;
  fallRecover?: boolean;
  fallRecoverTime?: number;
  hitVelX?: number;
  hitVelY?: number;
  hitFallVelocity?: { x: number; y: number };
  hitReactionElapsed?: number;
  juggle?: number;
  juggleMax?: number;
  juggleRemaining?: number;
  guardIntent?: boolean;
  guardCrouchIntent?: boolean;
  hitBy?: string;
  notHitBy?: string;
  stateOwnerId?: number;
  selfStateOwnerId?: number;
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
  targetBind?: { ownerId: number; remaining: number; offsetX: number; offsetY: number };
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
  guarded?: boolean;
  spark?: { animNo: number; scope: 'common' | 'attacker'; x: number; y: number; available?: boolean };
  sound?: { group: number; index: number; scope: 'common' | 'attacker'; available?: boolean };
  envShake?: { time: number; frequency: number; amplitude: number; phase: number };
};

export type GameState = {
  frame: number;
  players: [PlayerState, PlayerState];
  projectiles: ProjectileState[];
  hitEvents: HitEvent[];
  explods: ExplodRuntimeState;
  pause?: PauseState;
  hitDiagnosticLines?: string[];
  commandBuffers?: [InputBuffer, InputBuffer];
  commandNames?: [ReadonlySet<string>, ReadonlySet<string>];
};
