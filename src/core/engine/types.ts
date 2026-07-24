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

export type AfterImageColor = {
  red: number;
  green: number;
  blue: number;
};

export type AfterImageFrame = {
  x: number;
  y: number;
  facing: 1 | -1;
  animNo: number;
  animTime: number;
  age: number;
};

export type AfterImageState = {
  enabled: boolean;
  remainingTime: number;
  captureTick: number;
  length: number;
  timeGap: number;
  frameGap: number;
  transparency: string;
  palette: {
    color: number;
    invertAll: boolean;
    bright: AfterImageColor;
    contrast: AfterImageColor;
    postBright: AfterImageColor;
    add: AfterImageColor;
    multiply: AfterImageColor;
  };
  frames: AfterImageFrame[];
};

export type PalFxColor = {
  red: number;
  green: number;
  blue: number;
};

export type BgPalFxState = {
  duration: number;
  remainingTime: number;
  elapsedTime: number;
  color: number;
  invertAll: boolean;
  add: PalFxColor;
  multiply: PalFxColor;
  sinAdd: PalFxColor & { period: number };
  ownerEntityId: number;
};

export type ActiveHitDef = {
  diagnosticId?: number;
  controllerKey?: string;
  damageValues?: [number, number];
  damageSource?: 'cns' | 'existing_fallback';
  missLogged?: boolean;
  rejectedLogged?: boolean;
  groundHitTime?: number;
  airHitTime?: number;
  groundHitTimeSource?: 'cns' | 'hardcoded';
  airHitTimeSource?: 'cns' | 'hardcoded';
  groundHitTimeFallbackReason?: string;
  airHitTimeFallbackReason?: string;
  animType?: 'Light' | 'Medium' | 'Hard' | 'Back' | 'Up' | 'DiagUp';
  groundAnimTypeRaw?: string;
  animTypeSource?: 'cns' | 'winmugen_default';
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
    envShake?: { time: number; frequency: number; amplitude: number; phase: number };
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
  guardSparkOffset?: { x: number; y: number };
  hitSound?: { group: number; index: number; scope: 'common' | 'attacker' };
  guardSound?: { group: number; index: number; scope: 'common' | 'attacker' };
  envShake?: { time: number; frequency: number; amplitude: number; phase: number };
  palFx?: Omit<BgPalFxState, 'remainingTime' | 'elapsedTime' | 'ownerEntityId'>;
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
  downBounce?: boolean;
};

export type PlayerState = {
  id: 1 | 2;
  name?: string;
  authorName?: string;
  palNo?: number;
  vars?: Record<number, number>;
  fvars?: Record<number, number>;
  sysVars?: Record<number, number>;
  sysFVars?: Record<number, number>;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  collisionWidth?: {
    groundFront: number;
    groundBack: number;
    airFront: number;
    airBack: number;
    height?: number;
    xScale?: number;
    yScale?: number;
  };
  life: number;
  koReason?: 'hit' | 'guard' | 'fall';
  power?: number;
  powerMax?: number;
  infinitePower?: boolean;
  sprPriority?: number;
  comboHitCount?: number;
  stateNo: number;
  prevStateNo?: number;
  stateHeaderAppliedStateNo?: number;
  stateTime: number;
  stateType: 'S' | 'C' | 'A' | 'L';
  moveType: 'I' | 'A' | 'H';
  physics: 'S' | 'C' | 'A' | 'N';
  ctrl: boolean;
  airJumpsUsed?: number;
  airJumpInputHeld?: boolean;
  animNo: number;
  animTime: number;
  hitPause: number;
  afterImage?: AfterImageState;
  palFx?: BgPalFxState;
  drawAngle?: number;
  drawScale?: { x: number; y: number };
  pauseControllerLatch?: { key: string; stateNo: number; stateTime: number };
  positionFrozen?: boolean;
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
  lieDownElapsed?: number;
  lieDownTime?: number;
  juggle?: number;
  juggleMax?: number;
  juggleRemaining?: number;
  juggleConsumedTargetIds?: number[];
  guardIntent?: boolean;
  guardCrouchIntent?: boolean;
  hitBy?: string;
  notHitBy?: string;
  hitAttributeSlots?: Array<{
    mode: 'allow' | 'deny';
    value: string;
    time: number;
  } | null>;
  hitOverrides?: Array<{
    slot: number;
    attr: string;
    stateNo: number;
    remaining: number;
    forceAir: boolean;
    stateOwnerId: 1 | 2;
  } | null>;
  reversalDef?: {
    attr: string;
    p1StateNo?: number;
    p2StateNo?: number;
    pauseTime: { p1: number; p2: number };
    hitDefId: number;
  };
  stateOwnerId?: number;
  selfStateOwnerId?: number;
  animationOwnerId?: 1 | 2;
  entityBind?: {
    targetEntityId: number;
    remaining: number;
    offsetX: number;
    offsetY: number;
    postype: 'foot' | 'mid' | 'head';
    facing: number;
  };
  moveContact?: {
    activeHitDefId: number;
    contact: boolean;
    hit: boolean;
    guarded: boolean;
    reversed?: boolean;
    elapsed?: number;
    hitCount: number;
  };
  projectileContacts?: Record<number, {
    contactTime: number;
    hitTime: number;
    guardedTime: number;
    cancelTime?: number;
  }>;
  targets?: Array<{
    playerId: number;
    hitDefId: number;
    activeHitDefId: number;
  }>;
  targetBind?: { ownerId: number; remaining: number; offsetX: number; offsetY: number };
  playerPush?: boolean;
  noAutoTurn?: boolean;
  assertSpecialFlags?: string[];
  debugClipboard?: string;
  screenBound?: {
    value: boolean;
    moveCameraX: boolean;
    moveCameraY: boolean;
  };
  hitDiagnosticLines?: string[];
  hitStun?: {
    activeHitDefId: number | null;
    selectedHitTime: number;
    kind: 'ground' | 'air' | 'down' | 'fallback';
    source: 'active_hitdef' | 'hardcoded';
    targetStateTypeAtHit: PlayerState['stateType'];
    fallbackReason?: string;
    elapsed: number;
    lastStateNo: number;
    blockedEvents?: string[];
    selectedAnim?: number;
    getHitVarYVelocitySource?: 'ground.velocity.y' | 'air.velocity.y' | 'down.velocity.y';
    groundVelocityAtHit?: { x: number; y: number };
    airVelocityAtHit?: { x: number; y: number };
    fallYVelocityAtHit?: number;
  };
};

export type HelperEntity = {
  entityId: number;
  helperId: number;
  rootEntityId: 1 | 2;
  parentEntityId: number;
  ownerCharacterId: 1 | 2;
  stateOwnerId: 1 | 2;
  animationOwnerId: 1 | 2;
  keyCtrl: boolean;
  ownPal: boolean;
  pauseMoveTime?: number;
  superMoveTime?: number;
  spawnFrame: number;
  player: PlayerState;
};

export type HelperRuntimeState = {
  entries: HelperEntity[];
  nextEntityId: number;
};

export type ProjectileState = {
  id: number;
  ownerId: 1 | 2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax?: number;
  ay?: number;
  facing: 1 | -1;
  animNo: number;
  animTime: number;
  hitAnimNo?: number;
  hitAnimDuration?: number;
  phase?: 'active' | 'hit';
  removeOnHit?: boolean;
  priority?: number;
  lifeTime: number;
  removeTime: number;
  hitDef: ActiveHitDef;
  hitBox: Rect;
  scaleX?: number;
  scaleY?: number;
};

export type HitEvent = {
  attackerId: 1 | 2;
  defenderId: 1 | 2;
  damage: number;
  guarded?: boolean;
  contact?: { x: number; y: number };
  spark?: { animNo: number; scope: 'common' | 'attacker'; x: number; y: number; coordinateSpace: 'stage'; available?: boolean; runtimeIntegrated?: boolean };
  sound?: { group: number; index: number; scope: 'common' | 'attacker'; available?: boolean; runtimeIntegrated?: boolean };
  envShake?: { time: number; frequency: number; amplitude: number; phase: number };
};

export type GameState = {
  frame: number;
  players: [PlayerState, PlayerState];
  projectiles: ProjectileState[];
  hitEvents: HitEvent[];
  explods: ExplodRuntimeState;
  helpers: HelperRuntimeState;
  pause?: PauseState;
  bgPalFx?: BgPalFxState;
  envColor?: { color: { red: number; green: number; blue: number }; remainingTime: number; under: boolean; ownerEntityId: number };
  hitDiagnosticLines?: string[];
  commandBuffers?: [InputBuffer, InputBuffer];
  commandNames?: [ReadonlySet<string>, ReadonlySet<string>];
};
