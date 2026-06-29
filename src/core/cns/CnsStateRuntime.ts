import type { CnsDocument, CnsStateController, CnsStateDefinition, CnsTrigger, CnsValue } from '../../mugen/common/cnsTypes';
import type { GameState, PlayerState } from '../engine/types';
import { calculateMugenAnimTime } from '../animation/AnimationDuration';
import { evaluateCnsRuntimeTrigger, evaluateCnsRuntimeTriggerGroup } from './CnsRuntimeTrigger';

export type CnsRuntimeTrace = {
  playerId: 1 | 2;
  stateNo: number;
  afterStateNo: number;
  animNo: number;
  afterAnimNo: number;
  stateTime: number;
  afterStateTime: number;
  mugenAnimTime: number;
  stateFound: boolean;
  executedControllers: string[];
  debugLines: string[];
};

export type CnsRuntimeInput = {
  p1Commands?: ReadonlySet<string>;
  p2Commands?: ReadonlySet<string>;
  getAnimationDuration?: (animNo: number) => number | null;
};

export type CnsRuntimeResult = { state: GameState; traces: CnsRuntimeTrace[] };

type ControllerResult = { player: PlayerState; executed: boolean; name: string };

type ControllerExecutionResult = {
  player: PlayerState;
  executedControllers: string[];
  debugLines: string[];
};

type ExtendedPlayerState = PlayerState & {
  power?: number;
  hitCount?: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
  playerPush?: boolean;
  sprPriority?: number;
  drawOffset?: { x: number; y: number };
  transparent?: string;
  width?: { edge?: number; player?: number };
  afterImageTime?: number;
  angle?: number;
  pauseTime?: number;
  superPauseTime?: number;
  hitBy?: string | null;
  notHitBy?: string | null;
};

const DEBUG_STATES = [-3, -2, -1, 0, 10, 11, 12] as const;

const RECOGNIZED_NO_OP_CONTROLLERS = new Map<string, string>([
  ['afterimage', 'AfterImage'],
  ['allpalfx', 'AllPalFX'],
  ['angledraw', 'AngleDraw'],
  ['appendtoclipboard', 'AppendToClipboard'],
  ['assertspecial', 'AssertSpecial'],
  ['attackdist', 'AttackDist'],
  ['bgpalfx', 'BGPalFX'],
  ['bindtoparent', 'BindToParent'],
  ['bindtoroot', 'BindToRoot'],
  ['bindtotarget', 'BindToTarget'],
  ['changeanim2', 'ChangeAnim2'],
  ['clearclipboard', 'ClearClipboard'],
  ['destroyself', 'DestroySelf'],
  ['displaytoclipboard', 'DisplayToClipboard'],
  ['envcolor', 'EnvColor'],
  ['envshake', 'EnvShake'],
  ['explod', 'Explod'],
  ['explodbindtime', 'ExplodBindTime'],
  ['forcefeedback', 'ForceFeedback'],
  ['gamemakeanim', 'GameMakeAnim'],
  ['gravity', 'Gravity'],
  ['helper', 'Helper'],
  ['hitdef', 'HitDef'],
  ['hitfallset', 'HitFallSet'],
  ['hitoverride', 'HitOverride'],
  ['makedust', 'MakeDust'],
  ['modifyexplod', 'ModifyExplod'],
  ['movehitreset', 'MoveHitReset'],
  ['palfx', 'PalFX'],
  ['parentvaradd', 'ParentVarAdd'],
  ['parentvarset', 'ParentVarSet'],
  ['playsnd', 'PlaySnd'],
  ['posfreeze', 'PosFreeze'],
  ['projectile', 'Projectile'],
  ['removeexplod', 'RemoveExplod'],
  ['reversaldef', 'ReversalDef'],
  ['screenbound', 'ScreenBound'],
  ['stopsnd', 'StopSnd'],
  ['sndpan', 'SndPan'],
  ['targetbind', 'TargetBind'],
  ['targetdrop', 'TargetDrop'],
  ['targetfacing', 'TargetFacing'],
  ['targetlifeadd', 'TargetLifeAdd'],
  ['targetpoweradd', 'TargetPowerAdd'],
  ['targetstate', 'TargetState'],
  ['targetveladd', 'TargetVelAdd'],
  ['targetvelset', 'TargetVelSet'],
  ['zoom', 'Zoom'],
]);

export function stepCnsStateRuntime(state: GameState, cns?: CnsDocument | null, input: CnsRuntimeInput = {}): CnsRuntimeResult {
  if (!cns) return { state, traces: [missingTrace(1, state.players[0], input), missingTrace(2, state.players[1], input)] };

  const p1 = stepPlayer(state.players[0], 1, cns, input, input.p1Commands);
  const p2 = stepPlayer(state.players[1], 2, cns, input, input.p2Commands);

  return { state: { ...state, players: [p1.player, p2.player] }, traces: [p1.trace, p2.trace] };
}

function stepPlayer(
  player: PlayerState,
  playerId: 1 | 2,
  cns: CnsDocument,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): { player: PlayerState; trace: CnsRuntimeTrace } {
  const originalStateNo = player.stateNo;
  let next = player;
  const trace: CnsRuntimeTrace = {
    playerId,
    stateNo: player.stateNo,
    afterStateNo: player.stateNo,
    animNo: player.animNo,
    afterAnimNo: player.animNo,
    stateTime: player.stateTime,
    afterStateTime: player.stateTime,
    mugenAnimTime: mugenAnimTime(player, input),
    stateFound: Boolean(findState(cns, player.stateNo)),
    executedControllers: [],
    debugLines: [],
  };

  const debugEnabled = shouldDebugRuntime(commands);
  if (debugEnabled) {
    appendDebug(trace, `scan ${stateScanSummary(cns)} cmds=${formatCommands(commands)}`);
    appendDebug(trace, `pipeline start state=${next.stateNo} type=${next.stateType} ctrl=${next.ctrl ? 1 : 0} time=${next.stateTime}`);
  }

  for (const negativeStateNo of [-3, -2, -1]) {
    const negativeState = findState(cns, negativeStateNo);
    if (!negativeState) {
      if (debugEnabled) appendDebug(trace, `S${negativeStateNo} missing`);
      continue;
    }
    if (debugEnabled) appendDebug(trace, `enter S${negativeStateNo} state=${next.stateNo} controllers=${negativeState.controllers.length}`);
    const result = executeStateControllers(next, negativeState, cns, input, commands, debugEnabled);
    next = result.player;
    trace.executedControllers.push(...result.executedControllers);
    trace.debugLines.push(...result.debugLines);
    if (debugEnabled) appendDebug(trace, `leave S${negativeStateNo} state=${next.stateNo}`);
    if (next.stateNo !== originalStateNo) {
      if (debugEnabled) appendDebug(trace, `negative exit original=${originalStateNo} current=${next.stateNo}`);
      return finishTrace(next, trace);
    }
  }

  const stateDef = findState(cns, next.stateNo);
  trace.stateFound = Boolean(stateDef);
  if (!stateDef) return finishTrace(next, trace);

  if (debugEnabled) appendDebug(trace, `enter current S${stateDef.stateNo} state=${next.stateNo}`);
  next = applyStateHeader(next, stateDef, false);
  if (debugEnabled) appendDebug(trace, `after header S${stateDef.stateNo} state=${next.stateNo} type=${next.stateType} ctrl=${next.ctrl ? 1 : 0}`);
  const result = executeStateControllers(next, stateDef, cns, input, commands, debugEnabled);
  next = result.player;
  trace.executedControllers.push(...result.executedControllers);
  trace.debugLines.push(...result.debugLines);
  if (debugEnabled) appendDebug(trace, `leave current S${stateDef.stateNo} state=${next.stateNo}`);

  return finishTrace(next, trace);
}

function finishTrace(player: PlayerState, trace: CnsRuntimeTrace): { player: PlayerState; trace: CnsRuntimeTrace } {
  trace.afterStateNo = player.stateNo;
  trace.afterAnimNo = player.animNo;
  trace.afterStateTime = player.stateTime;
  trace.debugLines.push(`finish state=${player.stateNo}`);
  if (shouldDebugExecuted(trace)) trace.executedControllers.push(`dbg finish state=${player.stateNo}`);
  return { player, trace };
}

function executeStateControllers(
  player: PlayerState,
  stateDef: CnsStateDefinition,
  cns: CnsDocument,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
  debugEnabled = false,
): ControllerExecutionResult {
  let next = player;
  const executedControllers: string[] = [];
  const debugLines: string[] = [];

  for (const controller of stateDef.controllers) {
    const run = shouldRun(controller, next, input, commands);
    const debugLine = debugControllerCheck(stateDef, controller, next, input, commands, run);
    if (debugEnabled && debugLine) {
      pushDebug(debugLines, executedControllers, debugLine);
      pushDebug(debugLines, executedControllers, `pipe before S${stateDef.stateNo} ${controller.type} v=${num(controller, 'value') ?? '?'} state=${next.stateNo} run=${run ? 1 : 0}`);
    }
    if (!run) continue;

    const beforeStateNo = next.stateNo;
    const result = executeController(next, controller, cns);
    next = result.player;
    if (debugEnabled && debugLine) {
      pushDebug(debugLines, executedControllers, `pipe after S${stateDef.stateNo} ${controller.type} executed=${result.executed ? 1 : 0} before=${beforeStateNo} after=${next.stateNo}`);
    }
    if (result.executed) {
      executedControllers.push(result.name);
      if (debugEnabled && beforeStateNo !== next.stateNo) {
        pushDebug(debugLines, executedControllers, `${result.name} ${beforeStateNo}->${next.stateNo}`);
      }
    }
  }

  if (debugEnabled) pushDebug(debugLines, executedControllers, `return S${stateDef.stateNo} state=${next.stateNo}`);
  return { player: next, executedControllers, debugLines };
}

function findState(cns: CnsDocument, stateNo: number): CnsStateDefinition | undefined {
  return cns.states.find((state) => state.stateNo === stateNo);
}

function enterState(player: PlayerState, stateNo: number, cns: CnsDocument): PlayerState {
  const stateDef = findState(cns, stateNo);
  if (!stateDef) return { ...player, stateNo, stateTime: 0 };

  const inferredAnimNo = inferDefaultAnimNo(stateNo, player.animNo);
  const animNo = stateDef.initialAnim ?? inferredAnimNo;
  const animChanged = player.animNo !== animNo;

  return {
    ...player,
    stateNo,
    stateTime: 0,
    animNo,
    animTime: animChanged ? 0 : player.animTime,
    stateType: stateDef.stateType ?? player.stateType,
    moveType: stateDef.moveType ?? player.moveType,
    physics: stateDef.physics ?? player.physics,
    ctrl: stateDef.ctrl ?? player.ctrl,
  };
}

function inferDefaultAnimNo(stateNo: number, currentAnimNo: number): number {
  if (stateNo === 0) return 0;
  return currentAnimNo;
}

function applyStateHeader(player: PlayerState, stateDef: CnsStateDefinition, resetAnimOnChange: boolean): PlayerState {
  const animNo = stateDef.initialAnim ?? player.animNo;
  return { ...player, stateType: stateDef.stateType ?? player.stateType, moveType: stateDef.moveType ?? player.moveType, physics: stateDef.physics ?? player.physics, ctrl: stateDef.ctrl ?? player.ctrl, animNo, animTime: resetAnimOnChange && player.animNo !== animNo ? 0 : player.animTime };
}

function shouldRun(controller: CnsStateController, player: PlayerState, input: CnsRuntimeInput, commands?: ReadonlySet<string>): boolean {
  if (controller.triggers.length === 0) return true;
  return evaluateCnsRuntimeTriggerGroup(controller.triggers.map(formatTrigger), { player, commands, animTime: mugenAnimTime(player, input) });
}

function debugControllerCheck(
  stateDef: CnsStateDefinition,
  controller: CnsStateController,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  run: boolean,
): string | null {
  const value = num(controller, 'value');
  const triggerText = controller.triggers.map(formatTrigger).join(' | ');
  const lowerTriggerText = triggerText.toLowerCase();
  const controllerType = controller.type.toLowerCase();
  const isCrouchRoute =
    stateDef.stateNo === -1 &&
    controllerType === 'changestate' &&
    (value === 10 || value === 11 || value === 12 || lowerTriggerText.includes('holddown'));

  if (!isCrouchRoute) return null;

  const animTime = mugenAnimTime(player, input);
  return `S${stateDef.stateNo} ${controller.type} v=${value ?? '?'} ${run ? 'OK' : 'NG'} state=${player.stateNo} type=${player.stateType} ctrl=${player.ctrl ? 1 : 0} time=${player.stateTime} animtime=${animTime} cmds=${formatCommands(commands)} trig=[${triggerText}] eval=[${formatTriggerEvaluations(controller, player, input, commands)}]`;
}

function formatTriggerEvaluations(
  controller: CnsStateController,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): string {
  const context = { player, commands, animTime: mugenAnimTime(player, input) };
  return controller.triggers
    .map((trigger) => `${formatTrigger(trigger)}=>${evaluateCnsRuntimeTrigger(trigger.expression, context) ? 'T' : 'F'}`)
    .join(' | ');
}

function formatTrigger(trigger: CnsTrigger): string {
  return `${trigger.name}: ${trigger.expression}`;
}

function mugenAnimTime(player: PlayerState, input: CnsRuntimeInput): number {
  const duration = input.getAnimationDuration?.(player.animNo) ?? null;
  return calculateMugenAnimTime(player.animTime, duration);
}

function executeController(player: PlayerState, controller: CnsStateController, cns: CnsDocument): ControllerResult {
  const type = controller.type.toLowerCase();
  if (type === 'null') return withPlayer(player, true, 'Null');
  if (type === 'changeanim') return changeAnim(player, controller);
  if (type === 'velset') return withPlayer({ ...player, vx: num(controller, 'x') ?? player.vx, vy: num(controller, 'y') ?? player.vy }, hasNum(controller, 'x') || hasNum(controller, 'y'), 'VelSet');
  if (type === 'veladd') return withPlayer({ ...player, vx: player.vx + (num(controller, 'x') ?? 0), vy: player.vy + (num(controller, 'y') ?? 0) }, hasNum(controller, 'x') || hasNum(controller, 'y'), 'VelAdd');
  if (type === 'velmul') return velMul(player, controller);
  if (type === 'posset') return withPlayer({ ...player, x: num(controller, 'x') ?? player.x, y: num(controller, 'y') ?? player.y }, hasNum(controller, 'x') || hasNum(controller, 'y'), 'PosSet');
  if (type === 'posadd') return withPlayer({ ...player, x: player.x + (num(controller, 'x') ?? 0), y: player.y + (num(controller, 'y') ?? 0) }, hasNum(controller, 'x') || hasNum(controller, 'y'), 'PosAdd');
  if (type === 'ctrlset') return setCtrl(player, controller);
  if (type === 'statetypeset') return stateTypeSet(player, controller);
  if (type === 'movetypeset') return moveTypeSet(player, controller);
  if (type === 'lifeadd') return addLife(player, controller);
  if (type === 'lifeset') return setLife(player, controller);
  if (type === 'poweradd') return addPower(player, controller);
  if (type === 'powerset') return setPower(player, controller);
  if (type === 'hitadd') return hitAdd(player, controller);
  if (type === 'attackmulset') return withExtendedPlayer(player, { attackMultiplier: num(controller, 'value') ?? 1 }, 'AttackMulSet');
  if (type === 'defencemulset') return withExtendedPlayer(player, { defenseMultiplier: num(controller, 'value') ?? 1 }, 'DefenceMulSet');
  if (type === 'playerpush') return withExtendedPlayer(player, { playerPush: (num(controller, 'value') ?? 1) !== 0 }, 'PlayerPush');
  if (type === 'sprpriority') return withExtendedPlayer(player, { sprPriority: num(controller, 'value') ?? 0 }, 'SprPriority');
  if (type === 'offset') return withExtendedPlayer(player, { drawOffset: { x: num(controller, 'x') ?? 0, y: num(controller, 'y') ?? 0 } }, 'Offset');
  if (type === 'trans') return withExtendedPlayer(player, { transparent: str(controller, 'trans') ?? str(controller, 'value') ?? '' }, 'Trans');
  if (type === 'width') return withExtendedPlayer(player, { width: { edge: num(controller, 'edge') ?? undefined, player: num(controller, 'player') ?? undefined } }, 'Width');
  if (type === 'afterimagetime') return withExtendedPlayer(player, { afterImageTime: num(controller, 'time') ?? num(controller, 'value') ?? 0 }, 'AfterImageTime');
  if (type === 'angleadd') return withExtendedPlayer(player, { angle: readAngle(player) + (num(controller, 'value') ?? 0) }, 'AngleAdd');
  if (type === 'anglemul') return withExtendedPlayer(player, { angle: readAngle(player) * (num(controller, 'value') ?? 1) }, 'AngleMul');
  if (type === 'angleset') return withExtendedPlayer(player, { angle: num(controller, 'value') ?? 0 }, 'AngleSet');
  if (type === 'hitby') return withExtendedPlayer(player, { hitBy: str(controller, 'value') ?? str(controller, 'attr') }, 'HitBy');
  if (type === 'nothitby') return withExtendedPlayer(player, { notHitBy: str(controller, 'value') ?? str(controller, 'attr') }, 'NotHitBy');
  if (type === 'hitfallvel') return withPlayer({ ...player, vy: num(controller, 'y') ?? player.vy }, hasNum(controller, 'y'), 'HitFallVel');
  if (type === 'hitvelset') return withPlayer({ ...player, vx: num(controller, 'x') ?? player.vx, vy: num(controller, 'y') ?? player.vy }, hasNum(controller, 'x') || hasNum(controller, 'y'), 'HitVelSet');
  if (type === 'hitfalldamage') return hitFallDamage(player, controller);
  if (type === 'pause') return withExtendedPlayer(player, { pauseTime: num(controller, 'time') ?? 0 }, 'Pause');
  if (type === 'superpause') return withExtendedPlayer(player, { superPauseTime: num(controller, 'time') ?? 0 }, 'SuperPause');
  if (type === 'selfstate') {
    const value = num(controller, 'value');
    return value === null ? withPlayer(player, false, 'SelfState') : withPlayer(enterState(player, value, cns), true, 'SelfState');
  }
  if (type === 'turn') return withPlayer({ ...player, facing: player.facing === 1 ? -1 : 1 }, true, 'Turn');
  if (type === 'varset') return setVarController(player, controller);
  if (type === 'varadd') return addVarController(player, controller);
  if (type === 'varrangeset') return varRangeSet(player, controller);
  if (type === 'varrandom') return varRandom(player, controller);
  if (type === 'changestate') {
    const value = num(controller, 'value');
    return value === null ? withPlayer(player, false, 'ChangeState') : withPlayer(enterState(player, value, cns), true, 'ChangeState');
  }

  const noOpName = RECOGNIZED_NO_OP_CONTROLLERS.get(type);
  if (noOpName) return withPlayer(player, true, noOpName);

  return withPlayer(player, false, controller.type);
}

function changeAnim(player: PlayerState, controller: CnsStateController): ControllerResult {
  const value = num(controller, 'value');
  if (value === null) return withPlayer(player, false, 'ChangeAnim');
  return withPlayer({ ...player, animNo: value, animTime: player.animNo === value ? player.animTime : 0 }, true, 'ChangeAnim');
}

function velMul(player: PlayerState, controller: CnsStateController): ControllerResult {
  const x = num(controller, 'x');
  const y = num(controller, 'y');
  return withPlayer({ ...player, vx: player.vx * (x ?? 1), vy: player.vy * (y ?? 1) }, x !== null || y !== null, 'VelMul');
}

function setCtrl(player: PlayerState, controller: CnsStateController): ControllerResult {
  const value = num(controller, 'value');
  return value === null ? withPlayer(player, false, 'CtrlSet') : withPlayer({ ...player, ctrl: value !== 0 }, true, 'CtrlSet');
}

function stateTypeSet(player: PlayerState, controller: CnsStateController): ControllerResult {
  const stateType = toStateType(str(controller, 'statetype')) ?? player.stateType;
  const moveType = toMoveType(str(controller, 'movetype')) ?? player.moveType;
  const physics = toPhysics(str(controller, 'physics')) ?? player.physics;
  const executed = str(controller, 'statetype') !== null || str(controller, 'movetype') !== null || str(controller, 'physics') !== null;
  return withPlayer({ ...player, stateType, moveType, physics }, executed, 'StateTypeSet');
}

function moveTypeSet(player: PlayerState, controller: CnsStateController): ControllerResult {
  const moveType = toMoveType(str(controller, 'value') ?? str(controller, 'movetype'));
  return moveType ? withPlayer({ ...player, moveType }, true, 'MoveTypeSet') : withPlayer(player, false, 'MoveTypeSet');
}

function addLife(player: PlayerState, controller: CnsStateController): ControllerResult {
  const value = num(controller, 'value');
  return value === null ? withPlayer(player, false, 'LifeAdd') : withPlayer({ ...player, life: Math.max(0, player.life + value) }, true, 'LifeAdd');
}

function setLife(player: PlayerState, controller: CnsStateController): ControllerResult {
  const value = num(controller, 'value');
  return value === null ? withPlayer(player, false, 'LifeSet') : withPlayer({ ...player, life: Math.max(0, value) }, true, 'LifeSet');
}

function addPower(player: PlayerState, controller: CnsStateController): ControllerResult {
  const value = num(controller, 'value');
  const powered = player as ExtendedPlayerState;
  return value === null ? withPlayer(player, false, 'PowerAdd') : withPlayer({ ...player, power: Math.max(0, (powered.power ?? 0) + value) } as PlayerState, true, 'PowerAdd');
}

function setPower(player: PlayerState, controller: CnsStateController): ControllerResult {
  const value = num(controller, 'value');
  return value === null ? withPlayer(player, false, 'PowerSet') : withPlayer({ ...player, power: Math.max(0, value) } as PlayerState, true, 'PowerSet');
}

function hitAdd(player: PlayerState, controller: CnsStateController): ControllerResult {
  const value = num(controller, 'value');
  const extended = player as ExtendedPlayerState;
  return value === null ? withPlayer(player, false, 'HitAdd') : withPlayer({ ...player, hitCount: Math.max(0, (extended.hitCount ?? 0) + value) } as PlayerState, true, 'HitAdd');
}

function hitFallDamage(player: PlayerState, controller: CnsStateController): ControllerResult {
  const value = num(controller, 'value');
  return value === null ? withPlayer(player, false, 'HitFallDamage') : withPlayer({ ...player, life: Math.max(0, player.life - value) }, true, 'HitFallDamage');
}

function setVarController(player: PlayerState, controller: CnsStateController): ControllerResult {
  const index = num(controller, 'v');
  const value = num(controller, 'value');
  return index === null || value === null ? withPlayer(player, false, 'VarSet') : withPlayer(setVar(player, index, value), true, 'VarSet');
}

function addVarController(player: PlayerState, controller: CnsStateController): ControllerResult {
  const index = num(controller, 'v');
  const value = num(controller, 'value');
  return index === null || value === null ? withPlayer(player, false, 'VarAdd') : withPlayer(setVar(player, index, getVar(player, index) + value), true, 'VarAdd');
}

function varRangeSet(player: PlayerState, controller: CnsStateController): ControllerResult {
  const first = num(controller, 'first');
  const last = num(controller, 'last') ?? first;
  const value = num(controller, 'value');
  if (first === null || last === null || value === null) return withPlayer(player, false, 'VarRangeSet');

  let next = player;
  for (let index = first; index <= last; index += 1) next = setVar(next, index, value);
  return withPlayer(next, true, 'VarRangeSet');
}

function varRandom(player: PlayerState, controller: CnsStateController): ControllerResult {
  const index = num(controller, 'v');
  const range = num(controller, 'range') ?? 1000;
  if (index === null) return withPlayer(player, false, 'VarRandom');
  return withPlayer(setVar(player, index, Math.floor(range / 2)), true, 'VarRandom');
}

function withExtendedPlayer(player: PlayerState, patch: Partial<ExtendedPlayerState>, name: string): ControllerResult {
  return withPlayer({ ...player, ...patch } as PlayerState, true, name);
}

function readAngle(player: PlayerState): number {
  return (player as ExtendedPlayerState).angle ?? 0;
}

function withPlayer(player: PlayerState, executed: boolean, name: string): ControllerResult {
  return { player, executed, name };
}

function num(controller: CnsStateController, key: string): number | null {
  return cnsValueToNumber(controller.params[key.toLowerCase()]);
}

function hasNum(controller: CnsStateController, key: string): boolean {
  return num(controller, key) !== null;
}

function str(controller: CnsStateController, key: string): string | null {
  const value = controller.params[key.toLowerCase()];
  return value === undefined || value === null ? null : String(value).trim();
}

function cnsValueToNumber(value: CnsValue | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toStateType(value: string | null): PlayerState['stateType'] | null {
  const normalized = value?.toUpperCase();
  return normalized === 'S' || normalized === 'C' || normalized === 'A' || normalized === 'L' ? normalized : null;
}

function toMoveType(value: string | null): PlayerState['moveType'] | null {
  const normalized = value?.toUpperCase();
  return normalized === 'I' || normalized === 'A' || normalized === 'H' ? normalized : null;
}

function toPhysics(value: string | null): PlayerState['physics'] | null {
  const normalized = value?.toUpperCase();
  return normalized === 'S' || normalized === 'C' || normalized === 'A' || normalized === 'N' ? normalized : null;
}

function getVar(player: PlayerState, index: number): number {
  return ((player as PlayerState & { vars?: Record<number, number> }).vars ?? {})[index] ?? 0;
}

function setVar(player: PlayerState, index: number, value: number): PlayerState {
  const vars = (player as PlayerState & { vars?: Record<number, number> }).vars ?? {};
  return { ...player, vars: { ...vars, [index]: value } } as PlayerState;
}

function shouldDebugRuntime(commands?: ReadonlySet<string>): boolean {
  return commands?.has('holddown') === true || commands?.has('down') === true;
}

function shouldDebugExecuted(trace: CnsRuntimeTrace): boolean {
  return trace.executedControllers.some((line) => line.startsWith('dbg '));
}

function appendDebug(trace: CnsRuntimeTrace, line: string): void {
  trace.debugLines.push(line);
  trace.executedControllers.push(`dbg ${line}`);
}

function pushDebug(debugLines: string[], executedControllers: string[], line: string): void {
  debugLines.push(line);
  executedControllers.push(`dbg ${line}`);
}

function stateScanSummary(cns: CnsDocument): string {
  return DEBUG_STATES.map((stateNo) => {
    const state = findState(cns, stateNo);
    return `S${stateNo}:${state ? state.controllers.length : 'missing'}`;
  }).join(' ');
}

function formatCommands(commands?: ReadonlySet<string>): string {
  return commands ? Array.from(commands).join(',') : '';
}

function missingTrace(playerId: 1 | 2, player: PlayerState, input: CnsRuntimeInput): CnsRuntimeTrace {
  return { playerId, stateNo: player.stateNo, afterStateNo: player.stateNo, animNo: player.animNo, afterAnimNo: player.animNo, stateTime: player.stateTime, afterStateTime: player.stateTime, mugenAnimTime: mugenAnimTime(player, input), stateFound: false, executedControllers: [], debugLines: [] };
}
