import type { CnsDocument, CnsStateController, CnsStateDefinition, CnsTrigger, CnsValue } from '../../mugen/common/cnsTypes';
import type { ActiveHitDef, GameState, PlayerState } from '../engine/types';
import { calculateMugenAnimTime } from '../animation/AnimationDuration';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';
import { evaluateCnsRuntimeTrigger, evaluateCnsRuntimeTriggerGroup, readNumberExpression, type CnsRuntimeTriggerContext } from './CnsRuntimeTrigger';

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
  getAnimationElementNo?: (animNo: number, animTime: number) => number | null;
  hitDiagnostics?: boolean;
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
  juggle?: number;
  hitCount?: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
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
  prevStateNo?: number;
  vars?: Record<number, number>;
  sysVars?: Record<number, number>;
  fvars?: Record<number, number>;
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
  ['fallenvshake', 'FallEnvShake'],
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

let nextActiveHitDefDiagnosticId = 1;

export function stepCnsStateRuntime(state: GameState, cns?: CnsDocument | null, input: CnsRuntimeInput = {}): CnsRuntimeResult {
  if (!cns) return { state, traces: [missingTrace(1, state.players[0], input), missingTrace(2, state.players[1], input)] };

  const p1 = stepPlayer(state.players[0], state.players[1], 1, cns, input, input.p1Commands);
  const p2 = stepPlayer(state.players[1], state.players[0], 2, cns, input, input.p2Commands);

  return { state: { ...state, players: [p1.player, p2.player] }, traces: [p1.trace, p2.trace] };
}

function stepPlayer(
  player: PlayerState,
  opponent: PlayerState,
  playerId: 1 | 2,
  cns: CnsDocument,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): { player: PlayerState; trace: CnsRuntimeTrace } {
  const originalStateNo = player.stateNo;
  let next = { ...player, playerPush: true, hitDiagnosticLines: [] };
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
  if (player.hitPause > 0) {
    trace.debugLines.push(`hitpause skip remaining=${player.hitPause}`);
    return finishTrace(next, trace);
  }
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
    if (debugEnabled) appendDebug(trace, formatStateDefOverview(negativeState));
    const negativeStateEntry = next;
    const result = executeStateControllers(next, opponent, negativeState, cns, input, commands, debugEnabled, negativeStateEntry);
    next = result.player;
    trace.executedControllers.push(...result.executedControllers);
    trace.debugLines.push(...result.debugLines);
    if (debugEnabled) appendDebug(trace, `leave S${negativeStateNo} state=${next.stateNo}`);
    if (next.stateNo !== originalStateNo) {
      if (debugEnabled) appendDebug(trace, `negative changed original=${originalStateNo} current=${next.stateNo}`);
      break;
    }
  }

  const stateDef = findState(cns, next.stateNo);
  trace.stateFound = Boolean(stateDef);
  if (!stateDef) return finishTrace(next, trace);

  if (debugEnabled) appendDebug(trace, `enter current S${stateDef.stateNo} state=${next.stateNo}`);
  if (debugEnabled) appendDebug(trace, formatStateDefOverview(stateDef));
  next = applyStateHeader(next, stateDef, false);
  if (debugEnabled) appendDebug(trace, `after header S${stateDef.stateNo} state=${next.stateNo} type=${next.stateType} ctrl=${next.ctrl ? 1 : 0}`);
  const result = executeStateControllers(next, opponent, stateDef, cns, input, commands, debugEnabled);
  next = result.player;
  trace.executedControllers.push(...result.executedControllers);
  trace.debugLines.push(...result.debugLines);
  if (next.stateNo !== stateDef.stateNo && next.stateTime === 0) {
    const enteredState = findState(cns, next.stateNo);
    if (enteredState) {
      if (debugEnabled) appendDebug(trace, `enter target S${enteredState.stateNo} state=${next.stateNo}`);
      if (debugEnabled) appendDebug(trace, formatStateDefOverview(enteredState));
      const enteredResult = executeStateControllers(next, opponent, enteredState, cns, input, commands, debugEnabled);
      next = enteredResult.player;
      trace.executedControllers.push(...enteredResult.executedControllers);
      trace.debugLines.push(...enteredResult.debugLines);
      if (debugEnabled) appendDebug(trace, `leave target S${enteredState.stateNo} state=${next.stateNo}`);
    }
  }
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
  opponent: PlayerState,
  stateDef: CnsStateDefinition,
  cns: CnsDocument,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
  debugEnabled = false,
  negativeStateEntry?: PlayerState,
): ControllerExecutionResult {
  let next = player;
  const executedControllers: string[] = [];
  const debugLines: string[] = [];

  for (const controller of stateDef.controllers) {
    const type = controller.type.toLowerCase();
    const triggerPlayer = negativeStateEntry && type !== 'changestate' && next.stateNo !== negativeStateEntry.stateNo
      ? withTriggerStateSnapshot(next, negativeStateEntry)
      : next;
    const run = shouldRun(controller, triggerPlayer, input, commands);
    const debugLine = debugControllerCheck(stateDef, controller, triggerPlayer, input, commands, run);
    if (debugEnabled && debugLine) {
      pushDebug(debugLines, executedControllers, debugLine);
      for (const line of formatState10Process(stateDef, controller, next, input, commands, run)) {
        pushDebug(debugLines, executedControllers, line);
      }
      pushDebug(debugLines, executedControllers, `pipe before S${stateDef.stateNo} ${controller.type} v=${num(controller, 'value') ?? '?'} state=${next.stateNo} run=${run ? 1 : 0}`);
    }
    if (!run) continue;

    const hitStunBlock = getHitStunControllerBlock(next, stateDef, controller, input, commands, opponent);
    if (hitStunBlock) {
      const blockedEvents = next.hitStun?.blockedEvents ?? [];
      const firstOccurrence = !blockedEvents.includes(hitStunBlock.key);
      next = {
        ...next,
        ctrl: false,
        hitStun: next.hitStun ? {
          ...next.hitStun,
          blockedEvents: firstOccurrence ? [...blockedEvents, hitStunBlock.key] : blockedEvents,
        } : next.hitStun,
        hitDiagnosticLines: input.hitDiagnostics !== false && firstOccurrence ? [
          ...(next.hitDiagnosticLines ?? []),
          `raw.hitstun_guard target=p${next.id}`,
          `  activeHitDefId=${next.hitStun?.activeHitDefId ?? 'none'} event=block_controller controller=${controller.type} value=${hitStunBlock.value} state=${stateDef.stateNo} reason=${hitStunBlock.reason}`,
        ] : next.hitDiagnosticLines,
      };
      continue;
    }

    const beforeStateNo = next.stateNo;
    const result = executeController(next, opponent, controller, cns, input, commands);
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

function withTriggerStateSnapshot(player: PlayerState, snapshot: PlayerState): PlayerState {
  return {
    ...player,
    stateNo: snapshot.stateNo,
    stateTime: snapshot.stateTime,
    stateType: snapshot.stateType,
    moveType: snapshot.moveType,
    physics: snapshot.physics,
    ctrl: snapshot.ctrl,
    animNo: snapshot.animNo,
    animTime: snapshot.animTime,
  };
}

function findState(cns: CnsDocument, stateNo: number): CnsStateDefinition | undefined {
  return cns.states.find((state) => state.stateNo === stateNo);
}

function enterState(player: PlayerState, opponent: PlayerState, stateNo: number, cns: CnsDocument): PlayerState {
  const stateDef = findState(cns, stateNo);
  if (!stateDef) return { ...player, stateNo, stateTime: 0 };

  const inferredAnimNo = inferDefaultAnimNo(stateNo, player.animNo);
  const animNo = stateDef.initialAnim ?? inferredAnimNo;
  const animChanged = player.animNo !== animNo;
  const powered = player as ExtendedPlayerState;
  const power = Math.max(0, (powered.power ?? 0) + (stateDef.powerAdd ?? 0));
  const hitDiagnosticLines = player.activeHitDef?.diagnosticId ? [
    ...(player.hitDiagnosticLines ?? []),
    `raw.hitdef_lifecycle activeHitDefId=${player.activeHitDef.diagnosticId}`,
    `  event=discard reason=state_change hitCount=${player.hitDefUsed ? 1 : 0}`,
  ] : player.hitDiagnosticLines;

  return {
    ...player,
    prevStateNo: player.stateNo,
    stateNo,
    stateTime: 0,
    animNo,
    animTime: animChanged ? 0 : player.animTime,
    stateType: stateDef.stateType ?? player.stateType,
    moveType: stateDef.moveType ?? player.moveType,
    physics: stateDef.physics ?? player.physics,
    ctrl: stateDef.ctrl ?? inferDefaultCtrl(stateNo, player.ctrl),
    facing: stateDef.faceP2 ? faceToward(player, opponent) : player.facing,
    power,
    juggle: stateDef.juggle ?? powered.juggle,
    activeHitDef: null,
    hitDefUsed: false,
    hitTargets: [],
    hitDiagnosticLines,
  } as PlayerState;
}

function faceToward(player: PlayerState, opponent: PlayerState): PlayerState['facing'] {
  return player.x <= opponent.x ? 1 : -1;
}

function inferDefaultAnimNo(stateNo: number, currentAnimNo: number): number {
  if (stateNo === 0) return 0;
  return currentAnimNo;
}

function inferDefaultCtrl(stateNo: number, currentCtrl: boolean): boolean {
  if (stateNo === 0) return true;
  return currentCtrl;
}

function applyStateHeader(player: PlayerState, stateDef: CnsStateDefinition, resetAnimOnChange: boolean): PlayerState {
  const animNo = stateDef.initialAnim ?? player.animNo;
  return { ...player, stateType: stateDef.stateType ?? player.stateType, moveType: stateDef.moveType ?? player.moveType, physics: stateDef.physics ?? player.physics, ctrl: stateDef.ctrl ?? player.ctrl, animNo, animTime: resetAnimOnChange && player.animNo !== animNo ? 0 : player.animTime };
}

function shouldRun(controller: CnsStateController, player: PlayerState, input: CnsRuntimeInput, commands?: ReadonlySet<string>): boolean {
  if (controller.triggers.length === 0) return true;
  return evaluateTriggerRecords(controller.triggers, createTriggerContext(player, input, commands));
}

function createTriggerContext(
  player: PlayerState,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): CnsRuntimeTriggerContext {
  return {
    player,
    commands,
    animTime: mugenAnimTime(player, input),
    animElemNo: input.getAnimationElementNo?.(player.animNo, player.animTime) ?? undefined,
    animationExists: input.getAnimationDuration ? (animNo) => input.getAnimationDuration?.(animNo) !== null : undefined,
  };
}

function evaluateTriggerRecords(triggers: readonly CnsTrigger[], context: CnsRuntimeTriggerContext): boolean {
  const triggerAll: CnsTrigger[] = [];
  const groups = new Map<number, CnsTrigger[]>();

  for (const trigger of triggers) {
    if (/^triggerall$/i.test(trigger.name)) {
      triggerAll.push(trigger);
      continue;
    }

    const match = trigger.name.match(/^trigger(\d+)$/i);
    const groupNo = match ? Number(match[1]) : 1;
    const existing = groups.get(groupNo) ?? [];
    existing.push(trigger);
    groups.set(groupNo, existing);
  }

  if (!triggerAll.every((trigger) => evaluateCnsRuntimeTrigger(trigger.expression, context))) return false;
  if (groups.size === 0) return triggerAll.length > 0;
  return Array.from(groups.values()).some((group) =>
    group.every((trigger) => evaluateCnsRuntimeTrigger(trigger.expression, context)),
  );
}

function getHitStunControllerBlock(
  player: PlayerState,
  stateDef: CnsStateDefinition,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): { key: string; value: number | string; reason: string } | null {
  if (!player.hitStun) return null;
  const type = controller.type.toLowerCase();
  if (type === 'ctrlset') {
    const value = num(controller, 'value', player, input, commands, opponent);
    if (value !== null && value !== 0) {
      return { key: `ctrlset:${stateDef.stateNo}:${controller.sourceLine ?? '-'}`, value, reason: 'hitstun_active' };
    }
  }
  if (type !== 'changestate') return null;
  const value = num(controller, 'value', player, input, commands, opponent);
  if (value === null) return null;
  if (stateDef.stateNo === -1) {
    return { key: `input:${controller.sourceLine ?? '-'}:${value}`, value, reason: 'input_changestate_during_hitstun' };
  }
  if (value === 0 || value === 52) {
    return { key: `recovery:${stateDef.stateNo}:${controller.sourceLine ?? '-'}:${value}`, value, reason: 'early_recovery_state_during_hitstun' };
  }
  return null;
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
  return `S${stateDef.stateNo} ${controller.type} v=${value ?? '?'} ${run ? 'OK' : 'NG'} state=${player.stateNo} type=${player.stateType} ctrl=${player.ctrl ? 1 : 0} time=${player.stateTime} animtime=${animTime} cmds=${formatCommands(commands)} trig=[${triggerText}] eval=[${formatTriggerEvaluations(controller, player, input, commands)}] group=[${formatTriggerGroupEvaluation(controller, player, input, commands)}]`;
}

function formatStateDefOverview(stateDef: CnsStateDefinition): string {
  const routes = stateDef.controllers
    .filter((controller) => controller.type.toLowerCase() === 'changestate')
    .map((controller) => `${controller.type}:${num(controller, 'value') ?? '?'}`)
    .join(',');

  const head = stateDef.controllers
    .slice(0, 16)
    .map((controller, index) => `${index}:${controller.type} v=${num(controller, 'value') ?? '?'}`)
    .join(' | ');

  return `STATEDEF S${stateDef.stateNo} controllers=${stateDef.controllers.length} routes=[${routes || 'none'}] head=[${head || 'none'}]`;
}

function formatState10Process(
  stateDef: CnsStateDefinition,
  controller: CnsStateController,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  run: boolean,
): string[] {
  if (stateDef.stateNo !== -1 || controller.type.toLowerCase() !== 'changestate' || num(controller, 'value') !== 10) return [];

  const context = { player, commands, animTime: mugenAnimTime(player, input) };
  const triggerAll = controller.triggers.filter((trigger) => /^triggerall$/i.test(trigger.name));
  const groups = collectTriggerGroups(controller.triggers);
  const sortedGroups = Array.from(groups.entries()).sort(([left], [right]) => left - right);
  const allResult = triggerAll.every((trigger) => evaluateCnsRuntimeTrigger(trigger.expression, context));
  const anyGroupResult = sortedGroups.length === 0
    ? triggerAll.length > 0
    : sortedGroups.some(([, triggers]) => triggers.every((trigger) => evaluateCnsRuntimeTrigger(trigger.expression, context)));
  const recordsResult = evaluateTriggerRecords(controller.triggers, context);
  const stringResult = evaluateCnsRuntimeTriggerGroup(controller.triggers.map(formatTrigger), context);

  return [
    `STATE10 01 input cmds=${formatCommands(commands)}`,
    `STATE10 02 candidate S-1 ChangeState value=10 current=${player.stateNo} type=${player.stateType} ctrl=${player.ctrl ? 1 : 0}`,
    `STATE10 03 triggerall ${formatTriggerList(triggerAll, context)} result=${allResult ? 'T' : 'F'}`,
    ...sortedGroups.map(([groupNo, triggers]) => `STATE10 04 group${groupNo} ${formatTriggerList(triggers, context)} result=${triggers.every((trigger) => evaluateCnsRuntimeTrigger(trigger.expression, context)) ? 'T' : 'F'}`),
    `STATE10 05 final all=${allResult ? 'T' : 'F'} anyGroup=${anyGroupResult ? 'T' : 'F'} records=${recordsResult ? 'T' : 'F'} string=${stringResult ? 'T' : 'F'} shouldRun=${run ? 'T' : 'F'}`,
    `STATE10 06 next ${run ? 'execute ChangeState' : 'skip ChangeState'} before=${player.stateNo}`,
  ];
}

function collectTriggerGroups(triggers: readonly CnsTrigger[]): Map<number, CnsTrigger[]> {
  const groups = new Map<number, CnsTrigger[]>();
  for (const trigger of triggers) {
    if (/^triggerall$/i.test(trigger.name)) continue;
    const match = trigger.name.match(/^trigger(\d+)$/i);
    const groupNo = match ? Number(match[1]) : 1;
    const existing = groups.get(groupNo) ?? [];
    existing.push(trigger);
    groups.set(groupNo, existing);
  }
  return groups;
}

function formatTriggerList(triggers: readonly CnsTrigger[], context: CnsRuntimeTriggerContext): string {
  if (triggers.length === 0) return 'none';
  return triggers.map((trigger) => `${trigger.name}:${trigger.expression}=${evaluateCnsRuntimeTrigger(trigger.expression, context) ? 'T' : 'F'}`).join(',');
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

function formatTriggerGroupEvaluation(
  controller: CnsStateController,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): string {
  const context = { player, commands, animTime: mugenAnimTime(player, input) };
  const triggerAll: CnsTrigger[] = [];
  const groups = new Map<number, CnsTrigger[]>();

  for (const trigger of controller.triggers) {
    if (/^triggerall$/i.test(trigger.name)) {
      triggerAll.push(trigger);
      continue;
    }

    const match = trigger.name.match(/^trigger(\d+)$/i);
    const groupNo = match ? Number(match[1]) : 1;
    const existing = groups.get(groupNo) ?? [];
    existing.push(trigger);
    groups.set(groupNo, existing);
  }

  const allResult = triggerAll.every((trigger) => evaluateCnsRuntimeTrigger(trigger.expression, context));
  const sortedGroups = Array.from(groups.entries()).sort(([left], [right]) => left - right);
  const groupSummaries = sortedGroups.map(([groupNo, triggers]) => {
    const items = triggers.map((trigger) => `${trigger.expression}:${evaluateCnsRuntimeTrigger(trigger.expression, context) ? 'T' : 'F'}`).join('&');
    const result = triggers.every((trigger) => evaluateCnsRuntimeTrigger(trigger.expression, context));
    return `g${groupNo}(${items})=${result ? 'T' : 'F'}`;
  });
  const groupDetails = sortedGroups.map(([groupNo, triggers]) => {
    const result = triggers.every((trigger) => evaluateCnsRuntimeTrigger(trigger.expression, context));
    const names = triggers.map((trigger) => trigger.name).join(',');
    const items = triggers.map((trigger) => `${trigger.name}:${trigger.expression}:${evaluateCnsRuntimeTrigger(trigger.expression, context) ? 'T' : 'F'}`).join('&');
    return `key=${groupNo} size=${triggers.length} result=${result ? 'T' : 'F'} names=[${names}] items=[${items}]`;
  });
  const groupKeys = sortedGroups.map(([groupNo]) => groupNo).join(',') || 'none';
  const anyGroupResult = sortedGroups.length === 0 ? triggerAll.length > 0 : sortedGroups.some(([, triggers]) => triggers.every((trigger) => evaluateCnsRuntimeTrigger(trigger.expression, context)));
  const recordResult = evaluateTriggerRecords(controller.triggers, context);
  const stringRuntimeResult = evaluateCnsRuntimeTriggerGroup(controller.triggers.map(formatTrigger), context);
  const allItems = triggerAll.map((trigger) => `${trigger.expression}:${evaluateCnsRuntimeTrigger(trigger.expression, context) ? 'T' : 'F'}`).join('&') || 'none';

  return `all(${allItems})=${allResult ? 'T' : 'F'} | ${groupSummaries.join(' | ') || 'groups=none'} | groupCount=${groups.size} allCount=${triggerAll.length} keys=[${groupKeys}] details=[${groupDetails.join(' || ') || 'none'}] | anyGroup=${anyGroupResult ? 'T' : 'F'} | final=${allResult && anyGroupResult ? 'T' : 'F'} | records=${recordResult ? 'T' : 'F'} | string=${stringRuntimeResult ? 'T' : 'F'}`;
}

function formatTrigger(trigger: CnsTrigger): string {
  return `${trigger.name}: ${trigger.expression}`;
}

function mugenAnimTime(player: PlayerState, input: CnsRuntimeInput): number {
  const duration = input.getAnimationDuration?.(player.animNo) ?? null;
  return calculateMugenAnimTime(player.animTime, duration);
}

function executeController(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  cns: CnsDocument,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  const type = controller.type.toLowerCase();
  if (type === 'null') return withPlayer(player, true, 'Null');
  if (type === 'changeanim') return changeAnim(player, opponent, controller, input, commands);
  if (type === 'velset') return velSet(player, opponent, controller, input, commands);
  if (type === 'veladd') return velAdd(player, opponent, controller, input, commands);
  if (type === 'velmul') return velMul(player, controller);
  if (type === 'posset') return posSet(player, controller);
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
  if (type === 'hitdef') return activateHitDef(player, controller, input, commands, opponent);
  if (type === 'movehitreset') return withPlayer({ ...player, hitDefUsed: false, hitTargets: [] }, true, 'MoveHitReset');
  if (type === 'hitfallvel') return withPlayer({ ...player, vy: num(controller, 'y') ?? player.vy }, hasNum(controller, 'y'), 'HitFallVel');
  if (type === 'hitvelset') return withPlayer({ ...player, vx: num(controller, 'x', player, input, commands, opponent) ?? player.vx, vy: num(controller, 'y', player, input, commands, opponent) ?? player.vy }, hasNum(controller, 'x', player, input, commands, opponent) || hasNum(controller, 'y', player, input, commands, opponent), 'HitVelSet');
  if (type === 'hitfalldamage') return hitFallDamage(player, controller);
  if (type === 'pause') return withExtendedPlayer(player, { pauseTime: num(controller, 'time') ?? 0 }, 'Pause');
  if (type === 'superpause') return withExtendedPlayer(player, { superPauseTime: num(controller, 'time') ?? 0 }, 'SuperPause');
  if (type === 'selfstate') {
    const value = num(controller, 'value');
    return value === null ? withPlayer(player, false, 'SelfState') : withPlayer(enterState(player, opponent, value, cns), true, 'SelfState');
  }
  if (type === 'turn') return withPlayer({ ...player, facing: player.facing === 1 ? -1 : 1 }, true, 'Turn');
  if (type === 'varset') return setVarController(player, controller, input, commands, opponent);
  if (type === 'varadd') return addVarController(player, controller, input, commands, opponent);
  if (type === 'varrangeset') return varRangeSet(player, controller);
  if (type === 'varrandom') return varRandom(player, controller);
  if (type === 'changestate') {
    const value = num(controller, 'value', player, input, commands, opponent);
    if (value === null) return withPlayer(player, false, 'ChangeState');
    const entered = enterState(player, opponent, value, cns);
    const ctrl = num(controller, 'ctrl', player, input, commands, opponent);
    return withPlayer(ctrl === null ? entered : { ...entered, ctrl: ctrl !== 0 }, true, 'ChangeState');
  }

  const noOpName = RECOGNIZED_NO_OP_CONTROLLERS.get(type);
  if (noOpName) return withPlayer(player, true, noOpName);

  return withPlayer(player, false, controller.type);
}

function changeAnim(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  const value = num(controller, 'value', player, input, commands, opponent);
  if (value === null) return withPlayer(player, false, 'ChangeAnim');
  const changedDuringHitStun = player.hitStun && player.animNo !== value;
  const hitDiagnosticLines = changedDuringHitStun && input.hitDiagnostics !== false ? [
    ...(player.hitDiagnosticLines ?? []),
    `raw.hit_anim_change target=p${player.id}`,
    `  activeHitDefId=${player.hitStun?.activeHitDefId ?? 'none'} from=${player.animNo} to=${value} state=${player.stateNo} controller=ChangeAnim reason=common_state_transition`,
  ] : player.hitDiagnosticLines;
  return withPlayer({ ...player, hitDiagnosticLines, animNo: value, animTime: player.animNo === value ? player.animTime : 0 }, true, 'ChangeAnim');
}

function velMul(player: PlayerState, controller: CnsStateController): ControllerResult {
  const x = num(controller, 'x');
  const y = num(controller, 'y');
  return withPlayer({ ...player, vx: player.vx * (x ?? 1), vy: player.vy * (y ?? 1) }, x !== null || y !== null, 'VelMul');
}

function velSet(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  const x = num(controller, 'x', player, input, commands, opponent);
  const y = num(controller, 'y', player, input, commands, opponent);
  return withPlayer(
    { ...player, vx: x === null ? player.vx : x * player.facing, vy: y ?? player.vy },
    x !== null || y !== null,
    'VelSet',
  );
}

function velAdd(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  const x = num(controller, 'x', player, input, commands, opponent);
  const y = num(controller, 'y', player, input, commands, opponent);
  return withPlayer(
    { ...player, vx: player.vx + (x ?? 0) * player.facing, vy: player.vy + (y ?? 0) },
    x !== null || y !== null,
    'VelAdd',
  );
}

function posSet(player: PlayerState, controller: CnsStateController): ControllerResult {
  const x = num(controller, 'x');
  const y = num(controller, 'y');
  return withPlayer(
    { ...player, x: x ?? player.x, y: y === null ? player.y : mugenYToInternalY(y) },
    x !== null || y !== null,
    'PosSet',
  );
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

function activateHitDef(
  player: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): ControllerResult {
  const controllerKey = [player.id, player.stateNo, controller.sourceFile ?? '-', controller.sourceLine ?? '-'].join(':');
  const existing = player.activeHitDef;
  if (player.hitDefUsed && existing?.controllerKey === controllerKey) {
    return withPlayer(player, true, 'HitDef');
  }
  const snapshot = evaluateHitDefSnapshot(controller, player, input, commands, opponent);
  const damage = snapshot.damage;
  const guardDamage = snapshot.guardDamage;
  const groundHitTime = snapshot.groundHitTime;
  const airHitTime = snapshot.airHitTime;
  const animTypeParam = controller.params.animtype;
  const animType = readGroundAnimType(animTypeParam);
  const animTypeSource = animTypeParam === undefined || animType === null ? 'existing_fallback' : 'cns';
  const selectedAnimType = animType ?? 'Light';
  const groundHitTimeFallbackReason = groundHitTime === undefined
    ? controller.params['ground.hittime'] === undefined ? 'missing_ground_hittime' : 'invalid_ground_hittime'
    : undefined;
  const airHitTimeFallbackReason = airHitTime === undefined
    ? controller.params['air.hittime'] === undefined ? 'missing_air_hittime' : 'invalid_air_hittime'
    : undefined;
  const damageSource = controller.params.damage === undefined || snapshot.invalidParameters.includes('damage') ? 'existing_fallback' : 'cns';
  const sameController = existing?.controllerKey === controllerKey;
  const snapshotSignature = JSON.stringify({ ...snapshot, animType: selectedAnimType, animTypeSource });
  const sameValues = sameController && existing.snapshotSignature === snapshotSignature;
  const diagnosticId = sameController && existing?.diagnosticId ? existing.diagnosticId : nextActiveHitDefDiagnosticId++;
  const action = sameController ? 'update' : 'create';
  const diagnosticsEnabled = input.hitDiagnostics !== false;
  const duplicateFirstSeen = diagnosticsEnabled && sameValues && !existing?.duplicateLogged;
  const hitDiagnosticLines = !diagnosticsEnabled ? [] : duplicateFirstSeen ? [
    ...(player.hitDiagnosticLines ?? []),
    `raw.hitdef_lifecycle activeHitDefId=${diagnosticId}`,
    `  event=duplicate_ignore reason=same_controller_same_values hitCount=${player.hitDefUsed ? 1 : 0}`,
  ] : sameValues ? (player.hitDiagnosticLines ?? []) : [
    ...(player.hitDiagnosticLines ?? []),
    `raw.hitdef_activate attacker=p${player.id} state=${player.stateNo} time=${player.stateTime}`,
    `  controller=${controller.sourceFile ?? '-'}:${controller.sourceLine ?? '-'} activeHitDefId=${diagnosticId}`,
    `  damage=${damage},${guardDamage} source=${damageSource} action=${action}`,
    `  groundHitTime=${groundHitTime ?? 28} source=${groundHitTime === undefined ? 'hardcoded' : 'cns'}${groundHitTimeFallbackReason ? ` fallbackReason=${groundHitTimeFallbackReason}` : ''}`,
    `  airHitTime=${airHitTime ?? 28} source=${airHitTime === undefined ? 'hardcoded' : 'cns'}${airHitTimeFallbackReason ? ` fallbackReason=${airHitTimeFallbackReason}` : ''}`,
    `  animType=${selectedAnimType} source=${animTypeSource}`,
    `raw.hitdef_parameters activeHitDefId=${diagnosticId}`,
    `  attr=${formatAttr(snapshot.attr)} hitflag=${snapshot.hitFlag ?? '-'} guardflag=${snapshot.guardFlag ?? '-'} priority=${formatPriority(snapshot.priority)}`,
    `  animtypes=ground:${selectedAnimType},air:${snapshot.airAnimType ?? '-'},fall:${snapshot.fallAnimType ?? '-'} types=ground:${snapshot.groundType ?? '-'},air:${snapshot.airType ?? '-'}`,
    `  pausetime=${snapshot.pauseTime.attacker},${snapshot.pauseTime.defender} guard.pausetime=${formatPair(snapshot.guardPauseTime)} hittime=${groundHitTime ?? '-'},${airHitTime ?? '-'},${snapshot.guardHitTime ?? '-'}`,
    `  velocity=ground:${formatPair(snapshot.groundVelocity)},air:${formatPair(snapshot.airVelocity)},guard:${formatPair(snapshot.guardVelocity)} ids=${snapshot.hitId ?? '-'},${snapshot.chainId ?? '-'},${snapshot.noChainIds?.join('|') || '-'}`,
    `  fall=${formatFall(snapshot.fall)}`,
    ...(snapshot.unappliedParameters.length > 0 ? [`raw.hitdef_unapplied activeHitDefId=${diagnosticId} params=${snapshot.unappliedParameters.join(',')} reason=stored_not_applied`] : []),
    ...(snapshot.invalidParameters.length > 0 ? [`raw.hitdef_invalid activeHitDefId=${diagnosticId} params=${snapshot.invalidParameters.join(',')} reason=evaluation_failed`] : []),
    `raw.hitdef_lifecycle activeHitDefId=${diagnosticId}`,
    `  event=${action} reason=controller_execute hitCount=${player.hitDefUsed ? 1 : 0}`,
  ];
  return withPlayer({
    ...player,
    hitDiagnosticLines,
    activeHitDef: {
      ...snapshot,
      diagnosticId,
      controllerKey,
      damageValues: [Math.max(0, damage), Math.max(0, guardDamage)],
      damageSource,
      snapshotSignature,
      groundHitTime,
      airHitTime,
      groundHitTimeSource: groundHitTime === undefined ? 'hardcoded' : 'cns',
      airHitTimeSource: airHitTime === undefined ? 'hardcoded' : 'cns',
      groundHitTimeFallbackReason,
      airHitTimeFallbackReason,
      animType: selectedAnimType,
      animTypeSource,
      missLogged: sameController ? existing?.missLogged : false,
      rejectedLogged: sameController ? existing?.rejectedLogged : false,
      duplicateLogged: diagnosticsEnabled && sameValues ? true : false,
    },
  }, true, 'HitDef');
}

type EvaluatedHitDefSnapshot = Pick<ActiveHitDef, 'damage' | 'guardDamage' | 'pauseTime' | 'groundVelocity' | 'airVelocity'> &
  Partial<ActiveHitDef> & { unappliedParameters: string[]; invalidParameters: string[] };

function evaluateHitDefSnapshot(
  controller: CnsStateController,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): EvaluatedHitDefSnapshot {
  const invalidParameters: string[] = [];
  const numValue = (key: string): number | undefined => {
    const raw = controller.params[key];
    if (raw === undefined) return undefined;
    const value = cnsValueToNumber(raw, player, input, commands, opponent);
    if (value === null) invalidParameters.push(key);
    return value ?? undefined;
  };
  const pairValue = (key: string): [number | undefined, number | undefined] => {
    const raw = controller.params[key];
    if (raw === undefined) return [undefined, undefined];
    const parts = Array.isArray(raw) ? raw : [raw];
    const first = cnsValueToNumber(parts[0], player, input, commands, opponent);
    const second = cnsValueToNumber(parts[1], player, input, commands, opponent);
    if (first === null || (parts.length > 1 && second === null)) invalidParameters.push(key);
    return [first ?? undefined, second ?? undefined];
  };
  const textValue = (key: string): string | undefined => {
    const raw = controller.params[key];
    if (raw === undefined) return undefined;
    return (Array.isArray(raw) ? raw.map(String).join(',') : String(raw)).trim();
  };
  const boolValue = (key: string): boolean | undefined => {
    const value = numValue(key);
    return value === undefined ? undefined : value !== 0;
  };
  const damage = pairValue('damage');
  const pause = pairValue('pausetime');
  const guardPause = pairValue('guard.pausetime');
  const groundVelocity = pairValue('ground.velocity');
  const airVelocity = pairValue('air.velocity');
  const guardVelocity = pairValue('guard.velocity');
  const priorityParts = controller.params.priority;
  const priorityValues = Array.isArray(priorityParts) ? priorityParts : priorityParts === undefined ? [] : [priorityParts];
  const priorityValue = priorityValues.length > 0 ? cnsValueToNumber(priorityValues[0], player, input, commands, opponent) : null;
  if (priorityValues.length > 0 && priorityValue === null) invalidParameters.push('priority');
  const attrParts = controller.params.attr;
  const attrValues = Array.isArray(attrParts) ? attrParts.map(String) : attrParts === undefined ? [] : String(attrParts).split(',');
  const fallVelocity = pairValue('fall.velocity');
  const noChainRaw = controller.params.nochainid;
  const noChainParts = Array.isArray(noChainRaw) ? noChainRaw : noChainRaw === undefined ? [] : [noChainRaw];
  const noChainIds = noChainParts.map((value) => cnsValueToNumber(value, player, input, commands, opponent));
  if (noChainIds.some((value) => value === null)) invalidParameters.push('nochainid');
  const presentUnapplied = [
    'attr', 'air.animtype', 'fall.animtype', 'hitflag', 'guardflag', 'priority', 'guard.pausetime',
    'ground.type', 'air.type', 'guard.hittime', 'ground.velocity', 'air.velocity', 'guard.velocity',
    'fall', 'fall.velocity', 'fall.xvelocity', 'fall.yvelocity', 'fall.recover', 'fall.recovertime',
    'fall.damage', 'fall.kill', 'id', 'chainid', 'nochainid',
  ].filter((key) => controller.params[key] !== undefined);
  return {
    damage: Math.max(0, damage[0] ?? 60),
    guardDamage: Math.max(0, damage[1] ?? 0),
    pauseTime: { attacker: Math.max(0, pause[0] ?? 4), defender: Math.max(0, pause[1] ?? 8) },
    groundVelocity: { x: groundVelocity[0] ?? -3.5, y: groundVelocity[1] ?? 0 },
    airVelocity: { x: airVelocity[0] ?? -2.5, y: airVelocity[1] ?? -5.5 },
    attr: attrValues.length > 0 ? { stateType: attrValues[0].trim().toUpperCase(), attackTypes: attrValues.slice(1).map((value) => value.trim().toUpperCase()) } : undefined,
    airAnimType: textValue('air.animtype'),
    fallAnimType: textValue('fall.animtype'),
    hitFlag: textValue('hitflag')?.toUpperCase(),
    guardFlag: textValue('guardflag')?.toUpperCase(),
    priority: priorityValue === null ? undefined : { value: priorityValue, ...(priorityValues[1] === undefined ? {} : { type: String(priorityValues[1]).trim() }) },
    guardPauseTime: guardPause[0] === undefined && guardPause[1] === undefined ? undefined : { attacker: Math.max(0, guardPause[0] ?? 0), defender: Math.max(0, guardPause[1] ?? 0) },
    groundType: textValue('ground.type'),
    airType: textValue('air.type'),
    groundHitTime: nonNegative(numValue('ground.hittime')),
    airHitTime: nonNegative(numValue('air.hittime')),
    guardHitTime: nonNegative(numValue('guard.hittime')),
    guardVelocity: guardVelocity[0] === undefined && guardVelocity[1] === undefined ? undefined : { x: guardVelocity[0] ?? 0, y: guardVelocity[1] ?? 0 },
    fall: {
      enabled: boolValue('fall'),
      animType: textValue('fall.animtype'),
      xVelocity: numValue('fall.xvelocity') ?? fallVelocity[0],
      yVelocity: numValue('fall.yvelocity') ?? fallVelocity[1],
      recover: boolValue('fall.recover'),
      recoverTime: nonNegative(numValue('fall.recovertime')),
      damage: nonNegative(numValue('fall.damage')),
      kill: boolValue('fall.kill'),
    },
    hitId: numValue('id'),
    chainId: numValue('chainid'),
    noChainIds: noChainIds.filter((value): value is number => value !== null),
    unappliedParameters: presentUnapplied,
    invalidParameters: Array.from(new Set(invalidParameters)),
  };
}

function nonNegative(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.max(0, value);
}

function formatPair(value: { x: number; y: number } | { attacker: number; defender: number } | undefined): string {
  if (!value) return '-';
  return 'x' in value ? `${value.x},${value.y}` : `${value.attacker},${value.defender}`;
}

function formatAttr(value: ActiveHitDef['attr']): string {
  return value ? `${value.stateType},${value.attackTypes.join('|')}` : '-';
}

function formatPriority(value: ActiveHitDef['priority']): string {
  return value ? `${value.value},${value.type ?? '-'}` : '-';
}

function formatFall(value: ActiveHitDef['fall']): string {
  if (!value) return '-';
  return `enabled:${value.enabled ?? '-'},anim:${value.animType ?? '-'},velocity:${value.xVelocity ?? '-'},${value.yVelocity ?? '-'},recover:${value.recover ?? '-'},recovertime:${value.recoverTime ?? '-'},damage:${value.damage ?? '-'},kill:${value.kill ?? '-'}`;
}

function readGroundAnimType(value: CnsValue | undefined): ActiveHitDef['animType'] | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'light') return 'Light';
  if (normalized === 'medium' || normalized === 'med') return 'Medium';
  if (normalized === 'hard' || normalized === 'heavy') return 'Hard';
  return null;
}

function setVarController(
  player: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): ControllerResult {
  const direct = findDirectVarAssignment(controller, player, input, commands, opponent);
  if (direct) {
    return withPlayer(setIndexedVar(player, direct.kind, direct.index, direct.value), true, 'VarSet');
  }

  const index = num(controller, 'v', player, input, commands, opponent);
  const value = num(controller, 'value', player, input, commands, opponent);
  return index === null || value === null ? withPlayer(player, false, 'VarSet') : withPlayer(setVar(player, index, value), true, 'VarSet');
}

function addVarController(
  player: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): ControllerResult {
  const index = num(controller, 'v', player, input, commands, opponent);
  const value = num(controller, 'value', player, input, commands, opponent);
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

function num(
  controller: CnsStateController,
  key: string,
  player?: PlayerState,
  input?: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
  opponent?: PlayerState,
): number | null {
  return cnsValueToNumber(controller.params[key.toLowerCase()], player, input, commands, opponent);
}

function hasNum(
  controller: CnsStateController,
  key: string,
  player?: PlayerState,
  input?: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
  opponent?: PlayerState,
): boolean {
  return num(controller, key, player, input, commands, opponent) !== null;
}

function str(controller: CnsStateController, key: string): string | null {
  const value = controller.params[key.toLowerCase()];
  return value === undefined || value === null ? null : String(value).trim();
}

function cnsValueToNumber(
  value: CnsValue | undefined,
  player?: PlayerState,
  input?: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
  opponent?: PlayerState,
): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  if (player && input) {
    const evaluated = readNumberExpression(String(value), {
      ...createTriggerContext(player, input, commands),
      ...(opponent ? { opponent } : {}),
    });
    if (evaluated !== null) return evaluated;
  }
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function setIndexedVar(player: PlayerState, kind: 'var' | 'sysvar' | 'fvar', index: number, value: number): PlayerState {
  if (kind === 'sysvar') {
    const sysVars = (player as ExtendedPlayerState).sysVars ?? {};
    return { ...player, sysVars: { ...sysVars, [index]: value } } as PlayerState;
  }

  if (kind === 'fvar') {
    const fvars = (player as ExtendedPlayerState).fvars ?? {};
    return { ...player, fvars: { ...fvars, [index]: value } } as PlayerState;
  }

  return setVar(player, index, value);
}

function findDirectVarAssignment(
  controller: CnsStateController,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): { kind: 'var' | 'sysvar' | 'fvar'; index: number; value: number } | null {
  for (const [key, value] of Object.entries(controller.params)) {
    const match = key.match(/^(var|sysvar|fvar)\((\d+)\)$/i);
    if (!match) continue;
    const resolved = cnsValueToNumber(value, player, input, commands, opponent);
    if (resolved === null) continue;
    return {
      kind: match[1].toLowerCase() as 'var' | 'sysvar' | 'fvar',
      index: Number(match[2]),
      value: resolved,
    };
  }

  return null;
}

function mugenYToInternalY(y: number): number {
  return y + DEFAULT_GROUND_Y;
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
