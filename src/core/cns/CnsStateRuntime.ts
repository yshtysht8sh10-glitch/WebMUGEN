import type { CnsDocument, CnsStateController, CnsStateDefinition, CnsTrigger, CnsValue } from '../../mugen/common/cnsTypes';
import type { GameState, PlayerState } from '../engine/types';
import { calculateMugenAnimTime } from '../animation/AnimationDuration';
import { evaluateCnsRuntimeTriggerGroup } from './CnsRuntimeTrigger';

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
};

export type CnsRuntimeInput = {
  p1Commands?: ReadonlySet<string>;
  p2Commands?: ReadonlySet<string>;
  getAnimationDuration?: (animNo: number) => number | null;
};

export type CnsRuntimeResult = { state: GameState; traces: CnsRuntimeTrace[] };

type ControllerResult = { player: PlayerState; executed: boolean; name: string };

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
  };

  for (const negativeStateNo of [-1, -2]) {
    const negativeState = findState(cns, negativeStateNo);
    if (!negativeState) continue;
    const result = executeStateControllers(next, negativeState, cns, input, commands);
    next = result.player;
    trace.executedControllers.push(...result.executedControllers);
    if (next.stateNo !== originalStateNo) return finishTrace(next, trace);
  }

  const stateDef = findState(cns, next.stateNo);
  trace.stateFound = Boolean(stateDef);
  if (!stateDef) return finishTrace(next, trace);

  next = applyStateHeader(next, stateDef, false);
  const result = executeStateControllers(next, stateDef, cns, input, commands);
  next = result.player;
  trace.executedControllers.push(...result.executedControllers);

  return finishTrace(next, trace);
}

function finishTrace(player: PlayerState, trace: CnsRuntimeTrace): { player: PlayerState; trace: CnsRuntimeTrace } {
  trace.afterStateNo = player.stateNo;
  trace.afterAnimNo = player.animNo;
  trace.afterStateTime = player.stateTime;
  return { player, trace };
}

function executeStateControllers(
  player: PlayerState,
  stateDef: CnsStateDefinition,
  cns: CnsDocument,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): { player: PlayerState; executedControllers: string[] } {
  let next = player;
  const executedControllers: string[] = [];

  for (const controller of stateDef.controllers) {
    if (!shouldRun(controller, next, input, commands)) continue;
    const result = executeController(next, controller, cns);
    next = result.player;
    if (result.executed) executedControllers.push(result.name);
  }

  return { player: next, executedControllers };
}

function findState(cns: CnsDocument, stateNo: number): CnsStateDefinition | undefined {
  return cns.states.find((state) => state.stateNo === stateNo);
}

function enterState(player: PlayerState, stateNo: number, cns: CnsDocument): PlayerState {
  const stateDef = findState(cns, stateNo);
  const base: PlayerState = { ...player, stateNo, stateTime: 0, animTime: 0 };
  if (!stateDef) return base;
  const animNo = stateDef.initialAnim ?? inferDefaultAnimNo(stateNo, player.animNo);
  return { ...base, stateType: stateDef.stateType ?? player.stateType, moveType: stateDef.moveType ?? player.moveType, physics: stateDef.physics ?? player.physics, ctrl: stateDef.ctrl ?? player.ctrl, animNo };
}

function inferDefaultAnimNo(stateNo: number, currentAnimNo: number): number {
  return stateNo >= 0 ? stateNo : currentAnimNo;
}

function applyStateHeader(player: PlayerState, stateDef: CnsStateDefinition, resetAnimOnChange: boolean): PlayerState {
  const animNo = stateDef.initialAnim ?? player.animNo;
  return { ...player, stateType: stateDef.stateType ?? player.stateType, moveType: stateDef.moveType ?? player.moveType, physics: stateDef.physics ?? player.physics, ctrl: stateDef.ctrl ?? player.ctrl, animNo, animTime: resetAnimOnChange && player.animNo !== animNo ? 0 : player.animTime };
}

function shouldRun(controller: CnsStateController, player: PlayerState, input: CnsRuntimeInput, commands?: ReadonlySet<string>): boolean {
  if (controller.triggers.length === 0) return true;
  return evaluateCnsRuntimeTriggerGroup(controller.triggers.map(formatTrigger), { player, commands, animTime: mugenAnimTime(player, input) });
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
  if (type === 'changeanim') return changeAnim(player, controller);
  if (type === 'velset') return withPlayer({ ...player, vx: num(controller, 'x') ?? player.vx, vy: num(controller, 'y') ?? player.vy }, hasNum(controller, 'x') || hasNum(controller, 'y'), 'VelSet');
  if (type === 'veladd') return withPlayer({ ...player, vx: player.vx + (num(controller, 'x') ?? 0), vy: player.vy + (num(controller, 'y') ?? 0) }, hasNum(controller, 'x') || hasNum(controller, 'y'), 'VelAdd');
  if (type === 'posset') return withPlayer({ ...player, x: num(controller, 'x') ?? player.x, y: num(controller, 'y') ?? player.y }, hasNum(controller, 'x') || hasNum(controller, 'y'), 'PosSet');
  if (type === 'posadd') return withPlayer({ ...player, x: player.x + (num(controller, 'x') ?? 0), y: player.y + (num(controller, 'y') ?? 0) }, hasNum(controller, 'x') || hasNum(controller, 'y'), 'PosAdd');
  if (type === 'ctrlset') return setCtrl(player, controller);
  if (type === 'statetypeset') return stateTypeSet(player, controller);
  if (type === 'movetypeset') return moveTypeSet(player, controller);
  if (type === 'lifeadd') return addLife(player, controller);
  if (type === 'poweradd') return addPower(player, controller);
  if (type === 'varset') return setVarController(player, controller);
  if (type === 'varadd') return addVarController(player, controller);
  if (type === 'changestate') {
    const value = num(controller, 'value');
    return value === null ? withPlayer(player, false, 'ChangeState') : withPlayer(enterState(player, value, cns), true, 'ChangeState');
  }
  return withPlayer(player, false, controller.type);
}

function changeAnim(player: PlayerState, controller: CnsStateController): ControllerResult {
  const value = num(controller, 'value');
  if (value === null) return withPlayer(player, false, 'ChangeAnim');
  return withPlayer({ ...player, animNo: value, animTime: player.animNo === value ? player.animTime : 0 }, true, 'ChangeAnim');
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

function addPower(player: PlayerState, controller: CnsStateController): ControllerResult {
  const value = num(controller, 'value');
  const powered = player as PlayerState & { power?: number };
  return value === null ? withPlayer(player, false, 'PowerAdd') : withPlayer({ ...player, power: Math.max(0, (powered.power ?? 0) + value) } as PlayerState, true, 'PowerAdd');
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

function missingTrace(playerId: 1 | 2, player: PlayerState, input: CnsRuntimeInput): CnsRuntimeTrace {
  return { playerId, stateNo: player.stateNo, afterStateNo: player.stateNo, animNo: player.animNo, afterAnimNo: player.animNo, stateTime: player.stateTime, afterStateTime: player.stateTime, mugenAnimTime: mugenAnimTime(player, input), stateFound: false, executedControllers: [] };
}
