import type { CnsDocument, CnsStateController, CnsStateDefinition, CnsTrigger, CnsValue } from '../../mugen/common/cnsTypes';
import type { ActiveHitDef, GameState, PlayerState } from '../engine/types';
import { readCnsConst } from './CnsConstants';
import { calculateMugenAnimTime } from '../animation/AnimationDuration';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';
import { activateMoveContact, resetMoveContact } from '../hitdef/MoveContactState';
import { removeTarget, selectTargets } from '../hitdef/TargetState';
import { normalizeHitAttribute } from '../hitdef/HitAttribute';
import { evaluateCnsRuntimeTrigger, evaluateCnsRuntimeTriggerGroup, readNumberExpression, resolveCnsRuntimeRedirect, type CnsRuntimeTriggerContext } from './CnsRuntimeTrigger';
import type { SoundPanEvent, SoundPlayEvent, SoundStopEvent } from '../audio/SoundEvent';
import { canEntityMoveDuringPause, type PauseControllerEvent, type PauseState } from '../pause/PauseSystem';
import {
  normalizeExplodFacing,
  resolveExplodOrigin,
  type ExplodBindTimeEvent,
  type ExplodCreateEvent,
  type ExplodCreateRequest,
  type ExplodModifyEvent,
  type ExplodModifyPatch,
  type ExplodPostype,
  type ExplodRemoveEvent,
  type RuntimeEntityRef,
} from '../explod/ExplodSystem';
import { addPlayerPower, setPlayerPower } from '../power/PowerGauge';
import type { AnimationTriggerInfo } from '../animation/AnimationPlayer';
import { countHelpers, createInitialHelperState, destroyHelper, spawnHelper, type HelperSpawnRequest } from '../helper/HelperSystem';

type RuntimeEntityContext = {
  kind: 'root' | 'helper';
  entityId: number;
  rootEntityId: 1 | 2;
  parentEntityId: number | null;
  ownerCharacterId: 1 | 2;
};

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
  entityId?: number;
};

export type CnsRuntimeInput = {
  p1Commands?: ReadonlySet<string>;
  p2Commands?: ReadonlySet<string>;
  getAnimationDuration?: (animNo: number) => number | null;
  getAnimationElementNo?: (animNo: number, animTime: number) => number | null;
  getAnimationTriggerInfo?: (animNo: number, animTime: number) => AnimationTriggerInfo | null;
  hitDiagnostics?: boolean;
  getCnsDocumentForPlayer?: (playerId: number) => CnsDocument | null | undefined;
  onSoundPlay?: (event: SoundPlayEvent) => void;
  onSoundStop?: (event: SoundStopEvent) => void;
  onSoundPan?: (event: SoundPanEvent) => void;
  onExplodCreate?: (event: ExplodCreateEvent) => void;
  onExplodModify?: (event: ExplodModifyEvent) => void;
  onExplodRemove?: (event: ExplodRemoveEvent) => void;
  onExplodBindTime?: (event: ExplodBindTimeEvent) => void;
  onPause?: (event: PauseControllerEvent) => void;
  onEnvironmentShake?: (event: { time: number; frequency: number; amplitude: number; phase: number }) => void;
  pauseState?: PauseState;
  screenWidth?: number;
  gameTime?: number;
  roundState?: number;
  roundNo?: number;
  matchOver?: boolean;
  roundWinner?: 1 | 2 | 'draw' | null;
  roundEndReason?: 'ko' | 'double_ko' | 'time_over';
  constants?: CnsDocument;
  entityContext?: RuntimeEntityContext;
  numHelper?: (helperId?: number) => number;
  onHelperSpawn?: (request: HelperSpawnRequest) => void;
  onHelperDestroy?: (entityId: number) => void;
};

export type CnsRuntimeResult = { state: GameState; traces: CnsRuntimeTrace[] };

type TargetOperation = {
  kind: 'state' | 'velSet' | 'velAdd' | 'lifeAdd' | 'powerAdd' | 'bind' | 'facing';
  ownerId: number;
  targetIds: number[];
  value?: number;
  x?: number;
  y?: number;
  time?: number;
  ownerX?: number;
  ownerY?: number;
  ownerFacing?: 1 | -1;
};

type ControllerResult = { player: PlayerState; executed: boolean; name: string; targetOperation?: TargetOperation };

type ControllerExecutionResult = {
  player: PlayerState;
  executedControllers: string[];
  debugLines: string[];
  targetOperations: TargetOperation[];
};

type ExtendedPlayerState = PlayerState & {
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
  ['displaytoclipboard', 'DisplayToClipboard'],
  ['envcolor', 'EnvColor'],
  ['envshake', 'EnvShake'],
  ['forcefeedback', 'ForceFeedback'],
  ['gamemakeanim', 'GameMakeAnim'],
  ['gravity', 'Gravity'],
  ['hitdef', 'HitDef'],
  ['hitoverride', 'HitOverride'],
  ['makedust', 'MakeDust'],
  ['movehitreset', 'MoveHitReset'],
  ['palfx', 'PalFX'],
  ['parentvaradd', 'ParentVarAdd'],
  ['parentvarset', 'ParentVarSet'],
  ['projectile', 'Projectile'],
  ['reversaldef', 'ReversalDef'],
  ['screenbound', 'ScreenBound'],
  ['zoom', 'Zoom'],
]);

let nextActiveHitDefDiagnosticId = 1;
const EMPTY_CNS_DOCUMENT: CnsDocument = { states: [], metadataSections: [] };

export function stepCnsStateRuntime(state: GameState, cns?: CnsDocument | null, input: CnsRuntimeInput = {}): CnsRuntimeResult {
  if (!cns) return { state, traces: [missingTrace(1, state.players[0], input), missingTrace(2, state.players[1], input)] };

  const initialHelpers = state.helpers ?? createInitialHelperState();
  const pendingSpawns: HelperSpawnRequest[] = [];
  const pendingDestroys = new Set<number>();
  const helperInput = (context: RuntimeEntityContext): CnsRuntimeInput => ({
    ...input,
    gameTime: state.frame,
    entityContext: context,
    numHelper: (helperId) => countHelpers(initialHelpers, context.rootEntityId, helperId),
    onHelperSpawn: (request) => pendingSpawns.push(request),
    onHelperDestroy: (entityId) => pendingDestroys.add(entityId),
  });
  const p1Cns = resolvePlayerCns(state.players[0], cns, input);
  const p2Cns = resolvePlayerCns(state.players[1], cns, input);
  const p1Context: RuntimeEntityContext = { kind: 'root', entityId: 1, rootEntityId: 1, parentEntityId: null, ownerCharacterId: 1 };
  const p2Context: RuntimeEntityContext = { kind: 'root', entityId: 2, rootEntityId: 2, parentEntityId: null, ownerCharacterId: 2 };
  const p1 = stepPlayer(state.players[0], state.players[1], 1, p1Cns, { ...helperInput(p1Context), constants: p1Cns }, input.p1Commands, state.frame);
  const p2 = stepPlayer(state.players[1], state.players[0], 2, p2Cns, { ...helperInput(p2Context), constants: p2Cns }, input.p2Commands, state.frame);

  const players = applyTargetOperations([p1.player, p2.player], [...p1.targetOperations, ...p2.targetOperations], cns, input);
  const helperTraces: CnsRuntimeTrace[] = [];
  let helpers = {
    ...initialHelpers,
    entries: initialHelpers.entries.map((helper) => {
      const helperCns = resolveCnsByOwner(helper.stateOwnerId, cns, input);
      const opponent = players[helper.rootEntityId === 1 ? 1 : 0];
      const context: RuntimeEntityContext = {
        kind: 'helper', entityId: helper.entityId, rootEntityId: helper.rootEntityId,
        parentEntityId: helper.parentEntityId, ownerCharacterId: helper.ownerCharacterId,
      };
      const commands = helper.keyCtrl ? (helper.rootEntityId === 1 ? input.p1Commands : input.p2Commands) : undefined;
      const stepped = stepPlayer(helper.player, opponent, helper.rootEntityId, helperCns, { ...helperInput(context), constants: helperCns }, commands, state.frame);
      stepped.trace.entityId = helper.entityId;
      helperTraces.push(stepped.trace);
      const stateOwnerId = stepped.player.stateOwnerId === 1 || stepped.player.stateOwnerId === 2
        ? stepped.player.stateOwnerId
        : helper.stateOwnerId;
      return { ...helper, stateOwnerId, player: stepped.player };
    }),
  };
  for (const entityId of pendingDestroys) helpers = destroyHelper(helpers, entityId);
  for (const request of pendingSpawns) {
    helpers = spawnHelper(helpers, request, resolveCnsByOwner(request.stateOwnerId, cns, input));
  }
  const helperDiagnostics = [
    ...pendingSpawns.map((request, index) => {
      const entity = helpers.entries[helpers.entries.length - pendingSpawns.length + index];
      return `raw.helper event=spawn entityId=${entity?.entityId ?? '-'} helperId=${request.helperId} root=${request.rootEntityId} parent=${request.parentEntityId} owner=${request.ownerCharacterId} state=${request.stateNo} anim=${entity?.player.animNo ?? '-'} frame=${state.frame} firstStep=next_frame`;
    }),
    ...Array.from(pendingDestroys, (entityId) => `raw.helper event=destroy entityId=${entityId} frame=${state.frame} result=removed`),
  ];
  return {
    state: { ...state, players, helpers, hitDiagnosticLines: [...(state.hitDiagnosticLines ?? []), ...helperDiagnostics] },
    traces: [p1.trace, p2.trace, ...helperTraces],
  };
}

function resolvePlayerCns(player: PlayerState, fallback: CnsDocument, input: CnsRuntimeInput): CnsDocument {
  return resolveCnsByOwner(player.stateOwnerId ?? player.selfStateOwnerId ?? player.id, fallback, input);
}

function resolveCnsByOwner(ownerId: number, fallback: CnsDocument, input: CnsRuntimeInput): CnsDocument {
  return input.getCnsDocumentForPlayer ? input.getCnsDocumentForPlayer(ownerId) ?? EMPTY_CNS_DOCUMENT : fallback;
}

function stepPlayer(
  player: PlayerState,
  opponent: PlayerState,
  playerId: 1 | 2,
  cns: CnsDocument,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
  runtimeFrame = 0,
): { player: PlayerState; trace: CnsRuntimeTrace; targetOperations: TargetOperation[] } {
  const originalStateNo = player.stateNo;
  const juggleMax = player.juggleMax ?? readAirJuggle(cns);
  const resetJuggle = player.stateType !== 'A' && player.stateType !== 'L' && player.moveType === 'I' && player.ctrl;
  let next: PlayerState = {
    ...player,
    collisionWidth: {
      groundFront: readCnsConst(cns, 'size.ground.front'),
      groundBack: readCnsConst(cns, 'size.ground.back'),
      airFront: readCnsConst(cns, 'size.air.front'),
      airBack: readCnsConst(cns, 'size.air.back'),
      height: readCnsConst(cns, 'size.height'),
      xScale: readCnsConst(cns, 'size.xscale'),
      yScale: readCnsConst(cns, 'size.yscale'),
    },
    playerPush: true,
    hitDiagnosticLines: [],
    juggleMax,
    juggleRemaining: resetJuggle ? juggleMax : player.juggleRemaining ?? juggleMax,
    guardIntent: commands?.has('holdback') ?? false,
    guardCrouchIntent: commands?.has('holddown') ?? false,
    positionFrozen: false,
  };
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
  const targetOperations: TargetOperation[] = [];

  const debugEnabled = shouldDebugRuntime(commands);
  if (player.hitPause > 0) {
    trace.debugLines.push(`hitpause skip remaining=${player.hitPause}`);
    return { ...finishTrace(appendFallPauseDiagnostic(next, runtimeFrame, 'hitpause', player.hitPause, input.hitDiagnostics !== false), trace), targetOperations };
  }
  if (input.pauseState && (input.pauseState.resumeGuard || !canEntityMoveDuringPause(input.pauseState, player.id))) {
    trace.debugLines.push(`global_pause skip reason=${input.pauseState.resumeGuard ? 'resume_guard' : input.pauseState.kind ?? 'pause'} remaining=${Math.max(input.pauseState.pauseTime, input.pauseState.superPauseTime)} owner=p${input.pauseState.ownerEntityId ?? '-'}`);
    return { ...finishTrace(appendFallPauseDiagnostic(
      next,
      runtimeFrame,
      input.pauseState.kind ?? 'pause',
      Math.max(input.pauseState.pauseTime, input.pauseState.superPauseTime),
      input.hitDiagnostics !== false,
    ), trace), targetOperations };
  }

  next = tickHitAttributeSlots(next);

  const stateDefBeforeNegative = findState(cns, next.stateNo);
  if (stateDefBeforeNegative) {
    next = applyStateHeader(next, stateDefBeforeNegative, false);
    next = forceHitStunControl(next, `statedef:${stateDefBeforeNegative.stateNo}`, input.hitDiagnostics !== false);
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
    const result = executeStateControllers(next, opponent, negativeState, cns, input, commands, debugEnabled, negativeStateEntry, runtimeFrame);
    next = result.player;
    trace.executedControllers.push(...result.executedControllers);
    trace.debugLines.push(...result.debugLines);
    targetOperations.push(...result.targetOperations);
    if (debugEnabled) appendDebug(trace, `leave S${negativeStateNo} state=${next.stateNo}`);
    if (next.stateNo !== originalStateNo) {
      if (debugEnabled) appendDebug(trace, `negative changed original=${originalStateNo} current=${next.stateNo}`);
      break;
    }
  }

  const stateDef = findState(cns, next.stateNo);
  trace.stateFound = Boolean(stateDef);
  if (!stateDef) {
    next = {
      ...next,
      hitDiagnosticLines: input.hitDiagnostics === false ? next.hitDiagnosticLines : [
        ...(next.hitDiagnosticLines ?? []),
        `raw.custom_state player=p${next.id}`,
        `  state=${next.stateNo} owner=${next.stateOwnerId ?? next.id} result=missing reason=state_not_found`,
      ],
    };
    return { ...finishTrace(next, trace), targetOperations };
  }
  if (debugEnabled) appendDebug(trace, `enter current S${stateDef.stateNo} state=${next.stateNo}`);
  if (debugEnabled) appendDebug(trace, formatStateDefOverview(stateDef));
  if (stateDef !== stateDefBeforeNegative) {
    next = applyStateHeader(next, stateDef, false);
    next = forceHitStunControl(next, `statedef:${stateDef.stateNo}`, input.hitDiagnostics !== false);
  }
  next = appendGetHitFrameDiagnostic(next, opponent, stateDef, input, commands, runtimeFrame, input.hitDiagnostics !== false);
  if (debugEnabled) appendDebug(trace, `after header S${stateDef.stateNo} state=${next.stateNo} type=${next.stateType} ctrl=${next.ctrl ? 1 : 0}`);
  const result = executeStateControllers(next, opponent, stateDef, cns, input, commands, debugEnabled, undefined, runtimeFrame);
  next = result.player;
  trace.executedControllers.push(...result.executedControllers);
  trace.debugLines.push(...result.debugLines);
  targetOperations.push(...result.targetOperations);
  if (next.stateNo !== stateDef.stateNo && next.stateTime === 0) {
    const enteredState = findState(cns, next.stateNo);
    if (enteredState) {
      if (debugEnabled) appendDebug(trace, `enter target S${enteredState.stateNo} state=${next.stateNo}`);
      if (debugEnabled) appendDebug(trace, formatStateDefOverview(enteredState));
      const enteredStateNo = next.stateNo;
      const enteredResult = executeStateControllers(next, opponent, enteredState, cns, input, commands, debugEnabled, undefined, runtimeFrame);
      next = enteredResult.player;
      if (next.stateNo !== enteredStateNo && next.stateTime === 0) {
        // This second destination has not run its own controllers yet. Keep its
        // first Time = 0 pass available after the following physics increment.
        next = { ...next, stateTime: -1 };
      }
      trace.executedControllers.push(...enteredResult.executedControllers);
      trace.debugLines.push(...enteredResult.debugLines);
      targetOperations.push(...enteredResult.targetOperations);
      if (debugEnabled) appendDebug(trace, `leave target S${enteredState.stateNo} state=${next.stateNo}`);
    }
  }
  if (debugEnabled) appendDebug(trace, `leave current S${stateDef.stateNo} state=${next.stateNo}`);

  return { ...finishTrace(next, trace), targetOperations };
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
  runtimeFrame = 0,
): ControllerExecutionResult {
  let next = player;
  const executedControllers: string[] = [];
  const debugLines: string[] = [];
  const targetOperations: TargetOperation[] = [];

  for (const controller of stateDef.controllers) {
    const type = controller.type.toLowerCase();
    const triggerPlayer = negativeStateEntry && type !== 'changestate' && next.stateNo !== negativeStateEntry.stateNo
      ? withTriggerStateSnapshot(next, negativeStateEntry)
      : next;
    const run = shouldRun(controller, triggerPlayer, input, commands, opponent);
    next = appendTargetCompositeTriggerDiagnostic(next, triggerPlayer, opponent, stateDef, controller, input, commands, runtimeFrame, run);
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
    if (result.targetOperation) targetOperations.push(result.targetOperation);
    next = forceHitStunControl(next, `controller:${stateDef.stateNo}:${controller.type}:${controller.sourceLine ?? '-'}`, input.hitDiagnostics !== false);
    if (debugEnabled && debugLine) {
      pushDebug(debugLines, executedControllers, `pipe after S${stateDef.stateNo} ${controller.type} executed=${result.executed ? 1 : 0} before=${beforeStateNo} after=${next.stateNo}`);
    }
    if (result.executed) {
      executedControllers.push(result.name);
      if (debugEnabled && beforeStateNo !== next.stateNo) {
        pushDebug(debugLines, executedControllers, `${result.name} ${beforeStateNo}->${next.stateNo}`);
      }
      if (stateDef.stateNo >= 0 && (type === 'changestate' || type === 'selfstate')) {
        if (input.hitDiagnostics !== false) {
          next = {
            ...next,
            hitDiagnosticLines: [
              ...(next.hitDiagnosticLines ?? []),
              `raw.controller_transition player=p${next.id}`,
              `  frame=${runtimeFrame} controller=${controller.type} from=${beforeStateNo} to=${next.stateNo} stopRemaining=1 reason=state_change_is_terminal`,
            ],
          };
        }
        break;
      }
      if (type === 'destroyself') break;
    }
  }

  if (debugEnabled) pushDebug(debugLines, executedControllers, `return S${stateDef.stateNo} state=${next.stateNo}`);
  return { player: next, executedControllers, debugLines, targetOperations };
}

function applyTargetOperations(
  initialPlayers: [PlayerState, PlayerState],
  operations: TargetOperation[],
  cns: CnsDocument,
  input: CnsRuntimeInput,
): [PlayerState, PlayerState] {
  let players = initialPlayers;
  for (const operation of operations) {
    const owner = players.find((candidate) => candidate.id === operation.ownerId);
    players = players.map((player) => {
      if (!operation.targetIds.includes(player.id)) return player;
      if (operation.kind === 'state' && operation.value !== undefined) {
        const ownerId = owner?.id ?? operation.ownerId;
        const ownerCns = resolveCnsByOwner(ownerId, cns, input);
        return { ...enterState(player, owner ?? player, operation.value, ownerCns, { ...input, constants: ownerCns }), stateOwnerId: ownerId };
      }
      if (operation.kind === 'velSet') return { ...player, vx: operation.x ?? player.vx, vy: operation.y ?? player.vy };
      if (operation.kind === 'velAdd') return { ...player, vx: player.vx + (operation.x ?? 0), vy: player.vy + (operation.y ?? 0) };
      if (operation.kind === 'lifeAdd') return { ...player, life: Math.max(0, player.life + (operation.value ?? 0)) };
      if (operation.kind === 'powerAdd') {
        const value = operation.value ?? 0;
        const next = addPlayerPower(player, value);
        return appendPowerDiagnostic(next, `raw.power entity=p${player.id} source=controller type=TargetPowerAdd before=${player.power} value=${value} after=${next.power} max=${next.powerMax}`);
      }
      if (operation.kind === 'facing') {
        const ownerFacing = operation.ownerFacing ?? owner?.facing ?? 1;
        return { ...player, facing: (ownerFacing * ((operation.value ?? 1) < 0 ? -1 : 1)) as 1 | -1 };
      }
      if (operation.kind === 'bind') {
        const ownerFacing = operation.ownerFacing ?? owner?.facing ?? 1;
        const offsetX = operation.x ?? 0;
        const offsetY = operation.y ?? 0;
        return {
          ...player,
          x: (operation.ownerX ?? owner?.x ?? player.x) + offsetX * ownerFacing,
          y: (operation.ownerY ?? owner?.y ?? player.y) + offsetY,
          targetBind: { ownerId: operation.ownerId, remaining: operation.time ?? 1, offsetX, offsetY },
        };
      }
      return player;
    }) as [PlayerState, PlayerState];
  }
  return players;
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

function readAirJuggle(cns: CnsDocument): number {
  const data = cns.metadataSections.find((section) => section.name.trim().toLowerCase() === 'data');
  const raw = data?.values.airjuggle;
  const value = raw === undefined || Array.isArray(raw) ? null : Number(raw);
  return value !== null && Number.isFinite(value) && value >= 0 ? value : 15;
}

function enterState(
  player: PlayerState,
  opponent: PlayerState,
  stateNo: number,
  cns: CnsDocument,
  input?: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): PlayerState {
  const stateDef = findState(cns, stateNo);
  if (!stateDef) return { ...player, stateNo, stateTime: 0 };

  const inferredAnimNo = inferDefaultAnimNo(stateNo, player.animNo);
  const expressionAnimNo = stateDef.initialAnimExpression && input
    ? cnsValueToNumber(stateDef.initialAnimExpression, player, input, commands, opponent)
    : null;
  const animNo = stateDef.initialAnim ?? expressionAnimNo ?? inferredAnimNo;
  const animChanged = player.animNo !== animNo;
  const powered = player as ExtendedPlayerState;
  const powerAdded = addPlayerPower(player, stateDef.powerAdd ?? 0);
  const preserveHitDef = stateDef.hitDefPersist === true;
  const preservedMoveContact = preserveMoveContact(player, stateDef.moveHitPersist === true, stateDef.hitCountPersist === true);
  const hitDiagnosticLines = player.activeHitDef?.diagnosticId ? [
    ...(player.hitDiagnosticLines ?? []),
    `raw.hitdef_lifecycle activeHitDefId=${player.activeHitDef.diagnosticId}`,
    `  event=${preserveHitDef ? 'preserve' : 'discard'} reason=state_change hitdefpersist=${preserveHitDef ? 1 : 0} movehitpersist=${stateDef.moveHitPersist ? 1 : 0} hitcountpersist=${stateDef.hitCountPersist ? 1 : 0} hitCount=${player.moveContact?.hitCount ?? 0}`,
  ] : player.hitDiagnosticLines;

  const entered = {
    ...powerAdded,
    prevStateNo: player.stateNo,
    stateNo,
    stateTime: 0,
    animNo,
    animTime: animChanged ? 0 : player.animTime,
    vx: stateDef.velocitySet ? stateDef.velocitySet.x * player.facing : player.vx,
    vy: stateDef.velocitySet ? stateDef.velocitySet.y : player.vy,
    stateType: toStateType(stateDef.stateType ?? null) ?? player.stateType,
    moveType: toMoveType(stateDef.moveType ?? null) ?? player.moveType,
    physics: toPhysics(stateDef.physics ?? null) ?? player.physics,
    ctrl: stateDef.ctrl ?? inferDefaultCtrl(stateNo, player.ctrl),
    facing: stateDef.faceP2 ? faceToward(player, opponent) : player.facing,
    juggle: stateDef.juggle ?? powered.juggle,
    activeHitDef: preserveHitDef ? player.activeHitDef : null,
    hitDefUsed: preserveHitDef ? player.hitDefUsed : false,
    hitTargets: preserveHitDef ? player.hitTargets ?? [] : [],
    moveContact: preservedMoveContact,
    pauseControllerLatch: undefined,
    hitDiagnosticLines,
  } as PlayerState;
  return stateDef.powerAdd === undefined
    ? entered
    : appendPowerDiagnostic(entered, `raw.power entity=p${player.id} source=statedef state=${stateNo} before=${player.power} delta=${stateDef.powerAdd} after=${entered.power} max=${entered.powerMax}`);
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
  const applyEntryVelocity = player.stateTime === 0 && stateDef.velocitySet !== undefined;
  return { ...player, stateType: toStateType(stateDef.stateType ?? null) ?? player.stateType, moveType: toMoveType(stateDef.moveType ?? null) ?? player.moveType, physics: toPhysics(stateDef.physics ?? null) ?? player.physics, ctrl: stateDef.ctrl ?? player.ctrl, juggle: stateDef.juggle ?? player.juggle, animNo, animTime: resetAnimOnChange && player.animNo !== animNo ? 0 : player.animTime, vx: applyEntryVelocity ? stateDef.velocitySet!.x * player.facing : player.vx, vy: applyEntryVelocity ? stateDef.velocitySet!.y : player.vy };
}

function shouldRun(controller: CnsStateController, player: PlayerState, input: CnsRuntimeInput, commands?: ReadonlySet<string>, opponent?: PlayerState): boolean {
  if (controller.triggers.length === 0) return true;
  return evaluateTriggerRecords(controller.triggers, createTriggerContext(player, input, commands, opponent));
}

function createTriggerContext(
  player: PlayerState,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
  opponent?: PlayerState,
): CnsRuntimeTriggerContext {
  const animationInfo = input.getAnimationTriggerInfo?.(player.animNo, player.animTime) ?? null;
  return {
    player,
    opponent,
    commands,
    animTime: mugenAnimTime(player, input),
    animElemNo: animationInfo?.elementNo ?? input.getAnimationElementNo?.(player.animNo, player.animTime) ?? undefined,
    animElemTime: animationInfo?.elementTime,
    animElemStarted: animationInfo?.elementStarted,
    animElemCount: animationInfo?.elementCount,
    animElemTimes: animationInfo?.elementTimes,
    animationExists: input.getAnimationDuration ? (animNo) => input.getAnimationDuration?.(animNo) !== null : undefined,
    constants: input.constants,
    gameTime: input.gameTime,
    roundState: input.roundState,
    roundNo: input.roundNo,
    matchOver: input.matchOver,
    roundWinner: input.roundWinner,
    isHelper: input.entityContext?.kind === 'helper',
    numHelper: input.numHelper,
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
      const guardControlTime = player.getHitVars?.guarded ? player.getHitVars.ctrltime : undefined;
      if (guardControlTime !== undefined && player.hitStun.elapsed >= guardControlTime) return null;
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

function forceHitStunControl(player: PlayerState, source: string, diagnosticsEnabled: boolean): PlayerState {
  if (!player.hitStun || !player.ctrl) return player;
  const guardControlTime = player.getHitVars?.guarded ? player.getHitVars.ctrltime : undefined;
  if (guardControlTime !== undefined && player.hitStun.elapsed >= guardControlTime) return player;
  const key = `ctrl-force:${source}`;
  const blockedEvents = player.hitStun.blockedEvents ?? [];
  const firstOccurrence = !blockedEvents.includes(key);
  return {
    ...player,
    ctrl: false,
    hitStun: {
      ...player.hitStun,
      blockedEvents: firstOccurrence ? [...blockedEvents, key] : blockedEvents,
    },
    hitDiagnosticLines: diagnosticsEnabled && firstOccurrence ? [
      ...(player.hitDiagnosticLines ?? []),
      `raw.hitstun_guard target=p${player.id}`,
      `  activeHitDefId=${player.hitStun.activeHitDefId ?? 'none'} event=force_ctrl_off source=${source} reason=hitstun_active`,
    ] : player.hitDiagnosticLines,
  };
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
  if (type === 'posfreeze') return withPlayer({ ...player, positionFrozen: (num(controller, 'value') ?? 1) !== 0 }, true, 'PosFreeze');
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
  if (type === 'hitby') return hitAttributeController(player, controller, 'allow', 'HitBy');
  if (type === 'nothitby') return hitAttributeController(player, controller, 'deny', 'NotHitBy');
  if (type === 'hitdef') return activateHitDef(player, controller, input, commands, opponent);
  if (type === 'movehitreset') return withPlayer(resetMoveContact(player), true, 'MoveHitReset');
  if (type.startsWith('target')) return executeTargetController(player, opponent, controller, input, commands);
  if (type === 'hitfallvel') return hitFallVel(player);
  if (type === 'hitfallset') return hitFallSet(player, controller, input, commands, opponent);
  if (type === 'hitvelset') return hitVelSet(player, controller);
  if (type === 'hitfalldamage') return hitFallDamage(player, controller);
  if (type === 'fallenvshake') return fallEnvShake(player, input);
  if (type === 'pause') return pauseController(player, opponent, controller, input, commands, false);
  if (type === 'superpause') return pauseController(player, opponent, controller, input, commands, true);
  if (type === 'playsnd') return playSound(player, opponent, controller, input, commands);
  if (type === 'stopsnd') return stopSound(player, opponent, controller, input, commands);
  if (type === 'sndpan') return panSound(player, opponent, controller, input, commands);
  if (type === 'explod') return createExplod(player, opponent, controller, input, commands);
  if (type === 'modifyexplod') return modifyExplod(player, opponent, controller, input, commands);
  if (type === 'removeexplod') return removeExplod(player, opponent, controller, input, commands);
  if (type === 'explodbindtime') return setExplodBindTime(player, opponent, controller, input, commands);
  if (type === 'helper') return createHelper(player, opponent, controller, input, commands);
  if (type === 'destroyself') {
    if (input.entityContext?.kind !== 'helper') return withPlayer(player, false, 'DestroySelf');
    input.onHelperDestroy?.(input.entityContext.entityId);
    return withPlayer(player, true, 'DestroySelf');
  }
  if (type === 'selfstate') {
    const value = num(controller, 'value');
    if (value === null) return withPlayer(player, false, 'SelfState');
    const selfOwnerId = player.selfStateOwnerId ?? player.id;
    const selfCns = resolveCnsByOwner(selfOwnerId, cns, input);
    return withPlayer({ ...enterState(player, opponent, value, selfCns, { ...input, constants: selfCns }, commands), stateOwnerId: selfOwnerId }, true, 'SelfState');
  }
  if (type === 'turn') return withPlayer({ ...player, facing: player.facing === 1 ? -1 : 1 }, true, 'Turn');
  if (type === 'varset') return setVarController(player, controller, input, commands, opponent);
  if (type === 'varadd') return addVarController(player, controller, input, commands, opponent);
  if (type === 'varrangeset') return varRangeSet(player, controller);
  if (type === 'varrandom') return varRandom(player, controller);
  if (type === 'changestate') {
    const value = num(controller, 'value', player, input, commands, opponent);
    if (value === null) return withPlayer(player, false, 'ChangeState');
    const entered = enterState(player, opponent, value, cns, input, commands);
    const ctrl = num(controller, 'ctrl', player, input, commands, opponent);
    return withPlayer(ctrl === null ? entered : { ...entered, ctrl: ctrl !== 0 }, true, 'ChangeState');
  }

  const noOpName = RECOGNIZED_NO_OP_CONTROLLERS.get(type);
  if (noOpName) return withPlayer(player, true, noOpName);

  return withPlayer(player, false, controller.type);
}

function appendTargetCompositeTriggerDiagnostic(
  outputPlayer: PlayerState,
  triggerPlayer: PlayerState,
  opponent: PlayerState,
  stateDef: CnsStateDefinition,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  runtimeFrame: number,
  aggregateResult: boolean,
): PlayerState {
  if (input.hitDiagnostics === false) return outputPlayer;
  const targetTrigger = controller.triggers.find((trigger) => /target\s*\(/i.test(trigger.expression));
  if (!targetTrigger || !controller.triggers.some((trigger) => /prevstateno|movecontact|movehit|moveguarded/i.test(trigger.expression))) {
    return outputPlayer;
  }

  const context = createTriggerContext(triggerPlayer, input, commands, opponent);
  const requestedText = targetTrigger.expression.match(/target\s*\(([^)]*)\)/i)?.[1]?.trim();
  const requestedId = requestedText === undefined ? undefined : readNumberExpression(requestedText, context);
  const redirected = resolveCnsRuntimeRedirect('target', requestedText, context);
  const contact = triggerPlayer.moveContact;
  const triggerResults = controller.triggers.map((trigger, index) =>
    `  trigger[${index}] ${trigger.name} expression=${trigger.expression} result=${evaluateCnsRuntimeTrigger(trigger.expression, context) ? 1 : 0}`,
  );
  return {
    ...outputPlayer,
    hitDiagnosticLines: [
      ...(outputPlayer.hitDiagnosticLines ?? []),
      `raw.target_composite_trigger frame=${runtimeFrame} entity=p${triggerPlayer.id} controller=${controller.type} state=${stateDef.stateNo}`,
      `  StateNo=${triggerPlayer.stateNo} PrevStateNo=${triggerPlayer.prevStateNo ?? triggerPlayer.stateNo} MoveContact=${contact?.contact ? 1 : 0} MoveHit=${contact?.hit ? 1 : 0} MoveGuarded=${contact?.guarded ? 1 : 0}`,
      `  activeTargetIds=${(triggerPlayer.targets ?? []).map((entry) => `${entry.hitDefId}->p${entry.playerId}`).join(',') || 'none'} targetRedirectRequestedId=${requestedId ?? 'invalid'} targetRedirectResolvedEntityId=${redirected?.id ?? 'none'} targetRedirectFound=${redirected ? 1 : 0} targetStateNo=${redirected?.stateNo ?? 'SFalse'} targetMoveType=${redirected?.moveType ?? 'SFalse'}`,
      ...triggerResults,
      `  triggerGroup aggregateResult=${aggregateResult ? 1 : 0} ChangeState=${controller.type.toLowerCase() === 'changestate' && aggregateResult ? 'eligible' : 'not_executed'} targetState=${num(controller, 'value', triggerPlayer, input, commands, opponent) ?? '-'} ctrlBefore=${triggerPlayer.ctrl ? 1 : 0} requestedCtrl=${num(controller, 'ctrl', triggerPlayer, input, commands, opponent) ?? 'statedef'}`,
    ],
  };
}

function createHelper(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  const context = input.entityContext;
  if (!context || !input.onHelperSpawn) return withPlayer(player, false, 'Helper');
  const stateNo = num(controller, 'stateno', player, input, commands, opponent);
  if (stateNo === null) return withPlayer(player, false, 'Helper');
  const offset = pair(controller, 'pos', player, input, commands, opponent, 0, 0);
  const postype = (str(controller, 'postype') ?? 'p1').replace(/^['"]|['"]$/g, '').toLowerCase();
  const screenWidth = input.screenWidth ?? 960;
  let x = player.x + offset.x * player.facing;
  let y = player.y + offset.y;
  if (postype === 'left') x = offset.x;
  else if (postype === 'right') x = screenWidth - offset.x;
  else if (postype === 'front') x = player.facing === 1 ? screenWidth - offset.x : offset.x;
  else if (postype === 'back') x = player.facing === 1 ? offset.x : screenWidth - offset.x;
  else if (postype === 'p2') {
    x = opponent.x + offset.x * opponent.facing;
    y = opponent.y + offset.y;
  }
  const facingValue = num(controller, 'facing', player, input, commands, opponent) ?? 1;
  const facing = (facingValue < 0 ? -player.facing : player.facing) as 1 | -1;
  input.onHelperSpawn({
    helperId: Math.trunc(num(controller, 'id', player, input, commands, opponent) ?? 0),
    rootEntityId: context.rootEntityId,
    parentEntityId: context.entityId,
    ownerCharacterId: context.ownerCharacterId,
    stateOwnerId: context.ownerCharacterId,
    animationOwnerId: context.ownerCharacterId,
    stateNo: Math.trunc(stateNo),
    x,
    y,
    facing,
    keyCtrl: (num(controller, 'keyctrl', player, input, commands, opponent) ?? 0) !== 0,
    ownPal: (num(controller, 'ownpal', player, input, commands, opponent) ?? 0) !== 0,
    spawnFrame: input.gameTime ?? 0,
    parent: player,
  });
  return withPlayer(player, true, 'Helper');
}

function executeTargetController(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  const type = controller.type.toLowerCase();
  const names: Record<string, string> = {
    targetbind: 'TargetBind', targetdrop: 'TargetDrop', targetfacing: 'TargetFacing', targetlifeadd: 'TargetLifeAdd',
    targetpoweradd: 'TargetPowerAdd', targetstate: 'TargetState', targetveladd: 'TargetVelAdd', targetvelset: 'TargetVelSet',
  };
  const name = names[type];
  if (!name) return withPlayer(player, false, controller.type);
  const id = num(controller, 'id', player, input, commands, opponent);
  const selected = selectTargets(player, id ?? undefined);
  const diagnostic = [
    ...(player.hitDiagnosticLines ?? []),
    `raw.target_controller owner=p${player.id} controller=${name}`,
    `  id=${id ?? 'all'} targets=${selected.map((entry) => entry.playerId).join(',') || 'none'} result=${selected.length > 0 ? (type === 'targetdrop' ? 'dropped' : 'queued') : 'noop'}${selected.length > 0 ? '' : ' reason=target_not_found'}`,
  ];
  let next = { ...player, hitDiagnosticLines: input.hitDiagnostics === false ? player.hitDiagnosticLines : diagnostic };
  if (type === 'targetdrop') {
    for (const target of selected) next = removeTarget(next, target.playerId);
    return withPlayer(next, true, name);
  }
  if (selected.length === 0) return withPlayer(next, true, name);

  const kinds: Record<string, TargetOperation['kind']> = {
    targetbind: 'bind', targetfacing: 'facing', targetlifeadd: 'lifeAdd', targetpoweradd: 'powerAdd',
    targetstate: 'state', targetveladd: 'velAdd', targetvelset: 'velSet',
  };
  const [posX, posY] = readControllerPair(controller, 'pos', player, input, commands, opponent);
  return {
    player: next,
    executed: true,
    name,
    targetOperation: {
      kind: kinds[type],
      ownerId: player.id,
      targetIds: selected.map((entry) => entry.playerId),
      value: num(controller, 'value', player, input, commands, opponent) ?? undefined,
      x: type === 'targetbind' ? posX : num(controller, 'x', player, input, commands, opponent) ?? undefined,
      y: type === 'targetbind' ? posY : num(controller, 'y', player, input, commands, opponent) ?? undefined,
      time: num(controller, 'time', player, input, commands, opponent) ?? undefined,
      ownerX: player.x,
      ownerY: player.y,
      ownerFacing: player.facing,
    },
  };
}

function readControllerPair(
  controller: CnsStateController,
  key: string,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): [number | undefined, number | undefined] {
  const raw = controller.params[key];
  if (raw === undefined) return [undefined, undefined];
  const parts = Array.isArray(raw) ? raw : String(raw).split(',');
  return [
    cnsValueToNumber(parts[0], player, input, commands, opponent) ?? undefined,
    cnsValueToNumber(parts[1], player, input, commands, opponent) ?? undefined,
  ];
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

function hitVelSet(player: PlayerState, controller: CnsStateController): ControllerResult {
  const setX = (num(controller, 'x') ?? 0) !== 0;
  const setY = (num(controller, 'y') ?? 0) !== 0;
  return withPlayer({
    ...player,
    vx: setX ? player.hitVelX ?? player.vx : player.vx,
    vy: setY ? player.hitVelY ?? player.vy : player.vy,
  }, setX || setY, 'HitVelSet');
}

function hitFallVel(player: PlayerState): ControllerResult {
  const velocity = player.hitFallVelocity;
  if (!velocity) return withPlayer(player, true, 'HitFallVel');
  return withPlayer({ ...player, vx: velocity.x, vy: velocity.y }, true, 'HitFallVel');
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
  if (value === null) return withPlayer(player, false, 'PowerAdd');
  const next = addPlayerPower(player, value);
  return withPlayer(appendPowerDiagnostic(next, `raw.power entity=p${player.id} source=controller type=PowerAdd before=${player.power} value=${value} after=${next.power} max=${next.powerMax}`), true, 'PowerAdd');
}

function hitFallSet(
  player: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): ControllerResult {
  const value = num(controller, 'value', player, input, commands, opponent) ?? -1;
  const x = num(controller, 'xvel', player, input, commands, opponent);
  const y = num(controller, 'yvel', player, input, commands, opponent);
  const current = player.hitFallVelocity ?? { x: player.vx, y: player.vy };
  return withPlayer({
    ...player,
    hitFall: value < 0 ? player.hitFall : value !== 0,
    hitFallVelocity: x === null && y === null ? player.hitFallVelocity : { x: x ?? current.x, y: y ?? current.y },
  }, true, 'HitFallSet');
}

function setPower(player: PlayerState, controller: CnsStateController): ControllerResult {
  const value = num(controller, 'value');
  if (value === null) return withPlayer(player, false, 'PowerSet');
  const next = setPlayerPower(player, value);
  return withPlayer(appendPowerDiagnostic(next, `raw.power entity=p${player.id} source=controller type=PowerSet before=${player.power} value=${value} after=${next.power} max=${next.powerMax}`), true, 'PowerSet');
}

function appendPowerDiagnostic(player: PlayerState, line: string): PlayerState {
  return { ...player, hitDiagnosticLines: [...(player.hitDiagnosticLines ?? []), line] };
}

function hitAdd(player: PlayerState, controller: CnsStateController): ControllerResult {
  const value = num(controller, 'value');
  const extended = player as ExtendedPlayerState;
  return value === null ? withPlayer(player, false, 'HitAdd') : withPlayer({ ...player, hitCount: Math.max(0, (extended.hitCount ?? 0) + value) } as PlayerState, true, 'HitAdd');
}

function hitFallDamage(player: PlayerState, controller: CnsStateController): ControllerResult {
  const explicitValue = controller.params.value === undefined ? null : num(controller, 'value');
  const value = explicitValue ?? player.getHitVars?.['fall.damage'];
  if (value === undefined || value === null) return withPlayer(player, false, 'HitFallDamage');
  const canKill = player.getHitVars?.['fall.kill'] !== 0;
  const lifeBefore = player.life;
  const life = Math.max(canKill ? 0 : Math.min(1, lifeBefore), lifeBefore - Math.max(0, value));
  return withPlayer({
    ...player,
    life,
    koReason: lifeBefore > 0 && life <= 0 ? 'fall' : player.koReason,
    hitDiagnosticLines: [
      ...(player.hitDiagnosticLines ?? []),
      `raw.hit_fall_damage target=p${player.id}`,
      `  activeHitDefId=${player.hitStun?.activeHitDefId ?? 'none'} lifeBefore=${lifeBefore} damage=${Math.max(0, value)} lifeAfter=${life} kill=${canKill ? 1 : 0} result=applied`,
    ],
  }, true, 'HitFallDamage');
}

function playSound(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  const value = controller.params.value;
  const parts = Array.isArray(value) ? value : value === undefined ? [] : String(value).split(',');
  const groupPart = parts[0];
  const groupText = String(groupPart ?? '').trim();
  const scope: SoundPlayEvent['scope'] = /^f/i.test(groupText) ? 'common' : 'character';
  const normalizedGroupPart = /^[sf]/i.test(groupText) ? groupText.slice(1) : groupPart;
  const group = cnsValueToNumber(normalizedGroupPart, player, input, commands, opponent);
  const index = cnsValueToNumber(parts[1], player, input, commands, opponent);
  if (group === null || index === null) return withPlayer(player, false, 'PlaySnd');
  const relativePan = num(controller, 'pan', player, input, commands, opponent);
  const absolutePan = num(controller, 'abspan', player, input, commands, opponent);
  input.onSoundPlay?.({
    type: 'play',
    ownerId: player.selfStateOwnerId ?? player.id,
    scope,
    group: Math.trunc(group),
    index: Math.trunc(index),
    channel: num(controller, 'channel', player, input, commands, opponent),
    volume: num(controller, 'volume', player, input, commands, opponent) ?? 100,
    volumeScale: num(controller, 'volumescale', player, input, commands, opponent) ?? 100,
    pan: absolutePan ?? (relativePan ?? 0) * player.facing,
    absolutePan: absolutePan !== null,
    frequencyMultiplier: Math.max(0.01, num(controller, 'freqmul', player, input, commands, opponent) ?? 1),
    loop: (num(controller, 'loop', player, input, commands, opponent) ?? 0) !== 0,
  });
  return withPlayer(player, true, 'PlaySnd');
}

function pauseController(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  superPause: boolean,
): ControllerResult {
  const key = `${superPause ? 'superpause' : 'pause'}:${controller.sourceFile ?? '-'}:${controller.sourceLine ?? '-'}`;
  const latch = player.pauseControllerLatch;
  if (latch?.key === key && latch.stateNo === player.stateNo && latch.stateTime === player.stateTime) {
    return withPlayer(player, true, superPause ? 'SuperPause' : 'Pause');
  }
  input.onPause?.({
    type: superPause ? 'superpause' : 'pause',
    ownerEntityId: player.id,
    time: Math.max(0, Math.trunc(num(controller, 'time', player, input, commands, opponent) ?? (superPause ? 30 : 0))),
    moveTime: Math.max(0, Math.trunc(num(controller, 'movetime', player, input, commands, opponent) ?? 0)),
    darken: superPause && (num(controller, 'darken', player, input, commands, opponent) ?? 1) !== 0,
  });
  return withPlayer({ ...player, pauseControllerLatch: { key, stateNo: player.stateNo, stateTime: player.stateTime } }, true, superPause ? 'SuperPause' : 'Pause');
}

function fallEnvShake(player: PlayerState, input: CnsRuntimeInput): ControllerResult {
  const time = Number(player.getHitVars?.['fall.envshake.time'] ?? 0);
  const event = {
    time: Math.max(0, Number.isFinite(time) ? time : 0),
    frequency: Number(player.getHitVars?.['fall.envshake.freq'] ?? 60),
    amplitude: Number(player.getHitVars?.['fall.envshake.ampl'] ?? -4),
    phase: Number(player.getHitVars?.['fall.envshake.phase'] ?? 90),
  };
  if (event.time > 0) input.onEnvironmentShake?.(event);
  return withPlayer({
    ...player,
    hitDiagnosticLines: [
      ...(player.hitDiagnosticLines ?? []),
      `raw.fall_envshake target=p${player.id}`,
      `  time=${event.time} frequency=${event.frequency} amplitude=${event.amplitude} phase=${event.phase} result=${event.time > 0 ? 'started' : 'skipped'}`,
    ],
  }, true, 'FallEnvShake');
}

function appendGetHitFrameDiagnostic(
  player: PlayerState,
  opponent: PlayerState,
  stateDef: CnsStateDefinition,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  runtimeFrame: number,
  enabled: boolean,
): PlayerState {
  if (!enabled || ![5000, 5001, 5010, 5011, 5020, 5030, 5035, 5040, 5050, 5070, 5071, 5080, 5081, 5100, 5101, 5110, 5120, 5150, 5200, 5201, 5210].includes(stateDef.stateNo)) return player;
  const hitStun = player.hitStun;
  const source = hitStun?.getHitVarYVelocitySource
    ?? (hitStun?.targetStateTypeAtHit === 'L' ? 'down.velocity.y' : hitStun?.targetStateTypeAtHit === 'A' ? 'air.velocity.y' : 'ground.velocity.y');
  const hitTimeValue = readGetHitDiagnosticValue(player, 'hittime');
  const selectedHitTime = hitStun?.selectedHitTime ?? (typeof hitTimeValue === 'number' ? hitTimeValue : 0);
  const hitElapsed = hitStun?.elapsed ?? player.hitReactionElapsed ?? player.stateTime;
  const animElem = input.getAnimationTriggerInfo?.(player.animNo, player.animTime)?.elementNo
    ?? input.getAnimationElementNo?.(player.animNo, player.animTime)
    ?? '-';
  const routeLines = stateDef.controllers.flatMap((controller, controllerIndex) => {
    if (controller.type.toLowerCase() !== 'changestate') return [];
    const run = shouldRun(controller, player, input, commands, opponent);
    return [
      `raw.gethit_changestate_eval target=p${player.id}`,
      `  frame=${runtimeFrame} state=${stateDef.stateNo} controllerIndex=${controllerIndex} source=${controller.sourceFile ?? '-'}:${controller.sourceLine ?? '-'} stateTime=${player.stateTime} value=${num(controller, 'value') ?? '?'} result=${run ? 1 : 0} yvel=${readGetHitDiagnosticValue(player, 'yvel')} fall=${readGetHitDiagnosticValue(player, 'fall')} hitShakeOver=${player.hitPause <= 0 ? 1 : 0} hitOver=${hitElapsed >= selectedHitTime ? 1 : 0}`,
    ];
  });
  return {
    ...player,
    hitDiagnosticLines: [
      ...(player.hitDiagnosticLines ?? []),
      `raw.gethitvar_frame target=p${player.id}`,
      `  frame=${runtimeFrame} entity=p${player.id} state=${player.stateNo} prevState=${(player as ExtendedPlayerState).prevStateNo ?? '-'} stateTime=${player.stateTime} anim=${player.animNo} animTime=${player.animTime} animElem=${animElem} ctrl=${player.ctrl ? 1 : 0} stateType=${player.stateType} moveType=${player.moveType} physics=${player.physics} life=${player.life} ko=${player.life <= 0 ? 1 : 0}`,
      `  pos=${player.x},${player.y - DEFAULT_GROUND_Y} vel=${player.vx},${player.vy} yaccel=${readGetHitDiagnosticValue(player, 'yaccel')} ground=${player.y >= DEFAULT_GROUND_Y ? 1 : 0} landed=${player.y >= DEFAULT_GROUND_Y && player.vy > 0 ? 1 : 0} crossing=${player.y >= DEFAULT_GROUND_Y && player.vy > 0 ? 1 : 0} GroundClamp=${(player.stateType === 'A' || player.stateType === 'L') && player.moveType === 'H' ? 'defer_common_gethit' : 'normal'}`,
      `  activeHitDefId=${hitStun?.activeHitDefId ?? 'none'} hitStunElapsed=${hitStun?.elapsed ?? '-'} hitStunRemaining=${hitStun ? Math.max(0, hitStun.selectedHitTime - hitStun.elapsed) : '-'} hitPauseRemaining=${player.hitPause} hitShakeOver=${player.hitPause <= 0 ? 1 : 0} hitOver=${hitStun ? Number(hitStun.elapsed >= hitStun.selectedHitTime) : '-'}`,
      `  targetStateTypeAtHit=${hitStun?.targetStateTypeAtHit ?? '-'} animtype=${readGetHitDiagnosticValue(player, 'animtype')} air.animtype=${readGetHitDiagnosticValue(player, 'air.animtype')} fall.animtype=${readGetHitDiagnosticValue(player, 'fall.animtype')} groundtype=${readGetHitDiagnosticValue(player, 'groundtype')} airtype=${readGetHitDiagnosticValue(player, 'airtype')}`,
      `  hittime=${readGetHitDiagnosticValue(player, 'hittime')} yvel=${readGetHitDiagnosticValue(player, 'yvel')} yvelSource=${source} fall=${readGetHitDiagnosticValue(player, 'fall')} recover=${readGetHitDiagnosticValue(player, 'fall.recover')} recoverTime=${readGetHitDiagnosticValue(player, 'fall.recovertime')} CanRecover=${player.fallRecover !== false && hitElapsed >= (player.fallRecoverTime ?? 0) ? 1 : 0} recoveryInput=${commands?.has('recovery') ? 1 : 0} groundVelocityY=${hitStun?.groundVelocityAtHit?.y ?? '-'} airVelocityY=${hitStun?.airVelocityAtHit?.y ?? '-'} fallYVelocity=${hitStun?.fallYVelocityAtHit ?? readGetHitDiagnosticValue(player, 'fall.yvel')}`,
      `  downHitTime=${readGetHitDiagnosticValue(player, 'down.hittime')} downHitRemaining=${Math.max(0, Number(readGetHitDiagnosticValue(player, 'down.hittime')) - hitElapsed) || 0} lieDownElapsed=${player.lieDownElapsed ?? '-'} lieDownTime=${player.lieDownTime ?? '-'} lieDownRemaining=${player.lieDownTime === undefined ? '-' : Math.max(0, player.lieDownTime - (player.lieDownElapsed ?? 0))}`,
      `  ko=${player.life <= 0 ? 1 : 0} koReason=${player.koReason ?? '-'} hitKill=${readGetHitDiagnosticValue(player, 'kill')} guardKill=${readGetHitDiagnosticValue(player, 'guard.kill')} fallKill=${readGetHitDiagnosticValue(player, 'fall.kill')} lieDead=${player.stateNo === 5150 ? 1 : 0} roundState=${input.roundState ?? '-'} winner=${input.roundWinner ?? '-'} matchOver=${input.matchOver ? 1 : 0} roundEndRequested=${input.matchOver ? 1 : 0} roundEndReason=${input.roundEndReason ?? '-'}`,
      ...routeLines,
    ],
  };
}

function appendFallPauseDiagnostic(
  player: PlayerState,
  runtimeFrame: number,
  reason: string,
  remaining: number,
  enabled: boolean,
): PlayerState {
  if (!enabled || ![5030, 5035, 5040, 5050, 5070, 5071, 5080, 5081, 5100, 5101, 5110, 5120, 5150, 5200, 5201, 5210].includes(player.stateNo)) return player;
  return {
    ...player,
    hitDiagnosticLines: [
      ...(player.hitDiagnosticLines ?? []),
      `raw.fall_pause target=p${player.id}`,
      `  frame=${runtimeFrame} entity=p${player.id} state=${player.stateNo} stateTime=${player.stateTime} anim=${player.animNo} animTime=${player.animTime} pos=${player.x},${player.y - DEFAULT_GROUND_Y} vel=${player.vx},${player.vy} reason=${reason} remaining=${remaining} controllers=skipped clock=frozen`,
    ],
  };
}

function readGetHitDiagnosticValue(player: PlayerState, key: string): number | string {
  const value = player.getHitVars?.[key];
  if (value !== undefined) return value;
  if (key === 'yvel') return player.hitVelY ?? 0;
  if (key === 'fall') return player.hitFall ? 1 : 0;
  return '-';
}

function stopSound(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  input.onSoundStop?.({
    type: 'stop',
    ownerId: player.selfStateOwnerId ?? player.id,
    channel: num(controller, 'channel', player, input, commands, opponent),
  });
  return withPlayer(player, true, 'StopSnd');
}

function panSound(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  const relativePan = num(controller, 'pan', player, input, commands, opponent);
  const absolutePan = num(controller, 'abspan', player, input, commands, opponent);
  input.onSoundPan?.({
    type: 'pan',
    ownerId: player.selfStateOwnerId ?? player.id,
    channel: num(controller, 'channel', player, input, commands, opponent),
    pan: absolutePan ?? (relativePan === null ? null : relativePan * player.facing),
    mode: absolutePan !== null ? 'abspan' : relativePan !== null ? 'pan' : null,
  });
  return withPlayer(player, true, 'SndPan');
}

function createExplod(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  const owner: RuntimeEntityRef = { entityId: player.id, rootPlayerId: player.id };
  const rawAnim = controller.params.anim;
  if (rawAnim === undefined) {
    input.onExplodCreate?.({ type: 'rejected', owner, reason: 'missing_anim', rawAnim: '' });
    return withPlayer(player, true, 'Explod');
  }

  const animText = String(rawAnim).trim();
  const animationSource = /^f/i.test(animText) ? 'fightfx' as const : 'owner' as const;
  const animExpression = /^[fs]/i.test(animText) ? animText.slice(1) : rawAnim;
  const animNo = cnsValueToNumber(animExpression, player, input, commands, opponent);
  if (animNo === null) {
    input.onExplodCreate?.({ type: 'rejected', owner, reason: 'invalid_anim', rawAnim: animText });
    return withPlayer(player, true, 'Explod');
  }

  const postype = normalizeExplodPostype(str(controller, 'postype'));
  const offset = pair(controller, 'pos', player, input, commands, opponent, 0, 0);
  const velocity = pair(controller, 'vel', player, input, commands, opponent, 0, 0, 'velocity');
  const acceleration = pair(controller, 'accel', player, input, commands, opponent, 0, 0);
  const scale = pair(controller, 'scale', player, input, commands, opponent, 1, 1);
  const alpha = optionalPair(controller, 'alpha', player, input, commands, opponent);
  const random = pair(controller, 'random', player, input, commands, opponent, 0, 0);
  const facingParameter = normalizeExplodFacing(num(controller, 'facing', player, input, commands, opponent) ?? 1);
  const verticalFacing = normalizeExplodFacing(num(controller, 'vfacing', player, input, commands, opponent) ?? 1);
  const resolved = resolveExplodOrigin(postype, player, opponent, offset.x, offset.y, input.screenWidth ?? 640);
  const facing = normalizeExplodFacing(resolved.baseFacing * facingParameter);
  const bindTime = Math.trunc(num(controller, 'bindtime', player, input, commands, opponent) ?? 1);
  const rawRemoveTime = num(controller, 'removetime', player, input, commands, opponent) ?? -2;
  const request: ExplodCreateRequest = {
    mugenId: Math.trunc(num(controller, 'id', player, input, commands, opponent) ?? 0),
    owner,
    animationOwner: animationSource === 'owner' ? owner : null,
    animationSource,
    animNo: Math.trunc(animNo),
    position: { x: resolved.x, y: resolved.y },
    offset,
    velocity: { x: velocity.x * facing, y: velocity.y },
    acceleration: { x: acceleration.x * facing, y: acceleration.y },
    facing,
    verticalFacing,
    postype,
    coordinateSpace: resolved.coordinateSpace,
    bind: resolved.bindTargetEntityId === null || bindTime === 0 ? null : {
      targetEntityId: resolved.bindTargetEntityId,
      remaining: bindTime,
      offsetX: offset.x,
      offsetY: offset.y,
    },
    removeTime: rawRemoveTime === -1 ? null : Math.trunc(rawRemoveTime),
    spritePriority: Math.trunc(num(controller, 'sprpriority', player, input, commands, opponent) ?? 0),
    onTop: (num(controller, 'ontop', player, input, commands, opponent) ?? 0) !== 0,
    pauseMoveTime: Math.trunc(num(controller, 'pausemovetime', player, input, commands, opponent) ?? 0),
    superMoveTime: Math.trunc(num(controller, 'supermovetime', player, input, commands, opponent) ?? 0),
    removeOnGetHit: (num(controller, 'removeongethit', player, input, commands, opponent) ?? 0) !== 0,
    random,
    render: {
      transparency: str(controller, 'trans'),
      alpha: alpha ? { source: alpha.x, destination: alpha.y } : null,
      scaleX: scale.x,
      scaleY: scale.y,
      ownPalette: (num(controller, 'ownpal', player, input, commands, opponent) ?? (animationSource === 'fightfx' ? 1 : 0)) !== 0,
      shadow: triple(controller, 'shadow', player, input, commands, opponent, 0, 0, 0),
    },
  };
  input.onExplodCreate?.({ type: 'create', request });
  return withPlayer(player, true, 'Explod');
}

function modifyExplod(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  const owner: RuntimeEntityRef = { entityId: player.id, rootPlayerId: player.id };
  const patch: ExplodModifyPatch = {};
  const changedFields: string[] = [];
  const include = (field: string): void => { changedFields.push(field); };

  if (hasParam(controller, 'anim')) {
    const rawAnim = controller.params.anim;
    const animText = String(rawAnim).trim();
    const source = /^f/i.test(animText) ? 'fightfx' as const : 'owner' as const;
    const expression = /^[fs]/i.test(animText) ? animText.slice(1) : rawAnim;
    const animNo = cnsValueToNumber(expression, player, input, commands, opponent);
    if (animNo !== null) {
      patch.animation = { source, animNo: Math.trunc(animNo) };
      include('anim');
    }
  }
  const pos = optionalPair(controller, 'pos', player, input, commands, opponent);
  if (pos) { patch.offset = pos; include('pos'); }
  if (hasParam(controller, 'postype')) { patch.postype = normalizeExplodPostype(str(controller, 'postype')); include('postype'); }
  const facing = optionalNum(controller, 'facing', player, input, commands, opponent);
  if (facing !== null) { patch.facingParameter = normalizeExplodFacing(facing); include('facing'); }
  const verticalFacing = optionalNum(controller, 'vfacing', player, input, commands, opponent);
  if (verticalFacing !== null) { patch.verticalFacing = normalizeExplodFacing(verticalFacing); include('vfacing'); }
  const bindTime = optionalNum(controller, 'bindtime', player, input, commands, opponent);
  if (bindTime !== null) { patch.bindTime = Math.trunc(bindTime); include('bindtime'); }
  const velocity = optionalPair(controller, 'vel', player, input, commands, opponent);
  if (velocity) { patch.velocity = velocity; include('vel'); }
  const acceleration = optionalPair(controller, 'accel', player, input, commands, opponent);
  if (acceleration) { patch.acceleration = acceleration; include('accel'); }
  const random = optionalPair(controller, 'random', player, input, commands, opponent);
  if (random) { patch.random = random; include('random'); }
  const removeTime = optionalNum(controller, 'removetime', player, input, commands, opponent);
  if (removeTime !== null) { patch.removeTime = removeTime === -1 ? null : Math.trunc(removeTime); include('removetime'); }
  const superMoveTime = optionalNum(controller, 'supermovetime', player, input, commands, opponent);
  if (superMoveTime !== null) { patch.superMoveTime = Math.trunc(superMoveTime); include('supermovetime'); }
  const pauseMoveTime = optionalNum(controller, 'pausemovetime', player, input, commands, opponent);
  if (pauseMoveTime !== null) { patch.pauseMoveTime = Math.trunc(pauseMoveTime); include('pausemovetime'); }
  const scale = optionalPair(controller, 'scale', player, input, commands, opponent);
  if (scale) { patch.scale = scale; include('scale'); }
  const spritePriority = optionalNum(controller, 'sprpriority', player, input, commands, opponent);
  if (spritePriority !== null) { patch.spritePriority = Math.trunc(spritePriority); include('sprpriority'); }
  const onTop = optionalNum(controller, 'ontop', player, input, commands, opponent);
  if (onTop !== null) { patch.onTop = onTop !== 0; include('ontop'); }
  const shadow = optionalTriple(controller, 'shadow', player, input, commands, opponent);
  if (shadow) { patch.shadow = shadow; include('shadow'); }
  const ownPalette = optionalNum(controller, 'ownpal', player, input, commands, opponent);
  if (ownPalette !== null) { patch.ownPalette = ownPalette !== 0; include('ownpal'); }
  const removeOnGetHit = optionalNum(controller, 'removeongethit', player, input, commands, opponent);
  if (removeOnGetHit !== null) { patch.removeOnGetHit = removeOnGetHit !== 0; include('removeongethit'); }

  const requestedId = optionalNum(controller, 'id', player, input, commands, opponent);
  input.onExplodModify?.({
    type: 'modify',
    owner,
    mugenId: requestedId === null ? null : Math.trunc(requestedId),
    patch,
    changedFields,
    screenWidth: input.screenWidth ?? 640,
  });
  return withPlayer(player, true, 'ModifyExplod');
}

function removeExplod(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  const requestedId = optionalNum(controller, 'id', player, input, commands, opponent);
  input.onExplodRemove?.({
    type: 'remove',
    owner: { entityId: player.id, rootPlayerId: player.id },
    mugenId: requestedId === null ? null : Math.trunc(requestedId),
  });
  return withPlayer(player, true, 'RemoveExplod');
}

function setExplodBindTime(
  player: PlayerState,
  opponent: PlayerState,
  controller: CnsStateController,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): ControllerResult {
  const requestedId = optionalNum(controller, 'id', player, input, commands, opponent);
  const requestedTime = optionalNum(controller, 'time', player, input, commands, opponent);
  input.onExplodBindTime?.({
    type: 'bindtime',
    owner: { entityId: player.id, rootPlayerId: player.id },
    mugenId: requestedId === null ? null : Math.trunc(requestedId),
    time: requestedTime === null ? null : Math.trunc(requestedTime),
    screenWidth: input.screenWidth ?? 640,
  });
  return withPlayer(player, true, 'ExplodBindTime');
}

function normalizeExplodPostype(value: string | null): ExplodPostype {
  const normalized = value?.toLowerCase();
  return normalized === 'p2' || normalized === 'front' || normalized === 'back' || normalized === 'left' || normalized === 'right' || normalized === 'none'
    ? normalized
    : 'p1';
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
  const animTypeSource = animTypeParam === undefined ? 'winmugen_default' : animType === null ? 'winmugen_default' : 'cns';
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
    `  attr=${formatAttr(snapshot.attr)} hitflag=${snapshot.hitFlag ?? '-'} guardflag=${snapshot.guardFlag ?? '-'} guard.dist=${snapshot.guardDistance ?? '-'} guard.kill=${snapshot.guardKill === undefined ? '-' : snapshot.guardKill ? 1 : 0} priority=${formatPriority(snapshot.priority)}`,
    `  animtypes=ground:${selectedAnimType},air:${snapshot.airAnimType ?? '-'},fall:${snapshot.fallAnimType ?? '-'} types=ground:${snapshot.groundType ?? '-'},air:${snapshot.airType ?? '-'}`,
    `  pausetime=${snapshot.pauseTime.attacker},${snapshot.pauseTime.defender} guard.pausetime=${formatPair(snapshot.guardPauseTime)} hittime=${groundHitTime ?? '-'},${airHitTime ?? '-'},${snapshot.guardHitTime ?? '-'}`,
    `  velocity=ground:${formatPair(snapshot.groundVelocity)},air:${formatPair(snapshot.airVelocity)},guard:${formatPair(snapshot.guardVelocity)} ids=${snapshot.hitId ?? '-'},${snapshot.chainId ?? '-'},${snapshot.noChainIds?.join('|') || '-'}`,
    `  fall=${formatFall(snapshot.fall)}`,
    `  customState=p1:${snapshot.p1StateNo ?? '-'},p2:${snapshot.p2StateNo ?? '-'},p2getp1state:${formatOptionalBool(snapshot.p2GetP1State)},forcestand:${formatOptionalBool(snapshot.forceStand)}`,
    `  effects=spark:${formatEffectAnimation(snapshot.spark)},guardSpark:${formatEffectAnimation(snapshot.guardSpark)},sparkxy:${snapshot.sparkOffset?.x ?? 0},${snapshot.sparkOffset?.y ?? 0},hitsound:${formatEffectSound(snapshot.hitSound)},guardsound:${formatEffectSound(snapshot.guardSound)},envshake:${snapshot.envShake?.time ?? 0},${snapshot.envShake?.frequency ?? '-'},${snapshot.envShake?.amplitude ?? '-'},${snapshot.envShake?.phase ?? '-'}`,
    `  auxiliary=kill:${formatOptionalBool(snapshot.kill)},guard.kill:${formatOptionalBool(snapshot.guardKill)},fall.kill:${formatOptionalBool(snapshot.fall?.kill)},getpower:${formatPowerPair(snapshot.getPower)},givepower:${formatPowerPair(snapshot.givePower)},numhits:${snapshot.numHits ?? 1},cornerpush:${formatCornerPush(snapshot.cornerPush)},snap:${formatPoint(snapshot.snap)},sprpriority:${snapshot.p1SprPriority ?? '-'},${snapshot.p2SprPriority ?? '-'}`,
    ...(snapshot.unappliedParameters.length > 0 ? [`raw.hitdef_unapplied activeHitDefId=${diagnosticId} params=${snapshot.unappliedParameters.join(',')} reason=stored_not_applied`] : []),
    ...(snapshot.invalidParameters.length > 0 ? [`raw.hitdef_invalid activeHitDefId=${diagnosticId} params=${snapshot.invalidParameters.join(',')} reason=evaluation_failed`] : []),
    `raw.hitdef_lifecycle activeHitDefId=${diagnosticId}`,
    `  event=${action} reason=controller_execute hitCount=${player.hitDefUsed ? 1 : 0}`,
  ];
  const activatedPlayer = activateMoveContact(player, diagnosticId);
  return withPlayer({
    ...activatedPlayer,
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
  const getPower = pairValue('getpower');
  const givePower = pairValue('givepower');
  const snap = pairValue('snap');
  const priorityParts = controller.params.priority;
  const priorityValues = Array.isArray(priorityParts) ? priorityParts : priorityParts === undefined ? [] : [priorityParts];
  const priorityValue = priorityValues.length > 0 ? cnsValueToNumber(priorityValues[0], player, input, commands, opponent) : null;
  if (priorityValues.length > 0 && priorityValue === null) invalidParameters.push('priority');
  const attrParts = controller.params.attr;
  const attrValues = Array.isArray(attrParts) ? attrParts.map(String) : attrParts === undefined ? [] : String(attrParts).split(',');
  const normalizedAttr = attrValues.length > 0 ? normalizeHitAttribute(attrValues[0], attrValues.slice(1)) : undefined;
  if (attrValues.length > 0 && !normalizedAttr) invalidParameters.push('attr');
  const fallVelocity = pairValue('fall.velocity');
  const downVelocity = pairValue('down.velocity');
  const sparkOffset = pairValue('sparkxy');
  const noChainRaw = controller.params.nochainid;
  const noChainParts = Array.isArray(noChainRaw) ? noChainRaw : noChainRaw === undefined ? [] : [noChainRaw];
  const noChainIds = noChainParts.map((value) => cnsValueToNumber(value, player, input, commands, opponent));
  if (noChainIds.some((value) => value === null)) invalidParameters.push('nochainid');
  const hitId = numValue('id');
  const chainId = numValue('chainid');
  const presentUnapplied = [
    'fall.animtype',
    'ground.slidetime', 'guard.ctrltime',
  ].filter((key) => controller.params[key] !== undefined);
  return {
    damage: Math.max(0, damage[0] ?? 60),
    guardDamage: Math.max(0, numValue('guard.damage') ?? damage[1] ?? 0),
    guardKill: boolValue('guard.kill'),
    kill: boolValue('kill'),
    getPower: getPower[0] === undefined ? undefined : {
      hit: getPower[0], guarded: getPower[1] ?? Math.trunc(getPower[0] / 2),
    },
    givePower: givePower[0] === undefined ? undefined : {
      hit: givePower[0], guarded: givePower[1] ?? Math.trunc(givePower[0] / 2),
    },
    numHits: Math.max(0, Math.trunc(numValue('numhits') ?? 1)),
    cornerPush: {
      ground: numValue('ground.cornerpush.veloff'),
      air: numValue('air.cornerpush.veloff'),
      down: numValue('down.cornerpush.veloff'),
      guard: numValue('guard.cornerpush.veloff'),
      airGuard: numValue('airguard.cornerpush.veloff'),
    },
    snap: snap[0] === undefined && snap[1] === undefined ? undefined : { x: snap[0] ?? 0, y: snap[1] ?? 0 },
    p1SprPriority: numValue('p1sprpriority'),
    p2SprPriority: numValue('p2sprpriority'),
    p1StateNo: numValue('p1stateno'),
    p2StateNo: numValue('p2stateno'),
    p2GetP1State: boolValue('p2getp1state'),
    forceStand: boolValue('forcestand'),
    spark: parseEffectAnimation(controller.params.sparkno, player, input, commands, opponent),
    guardSpark: parseEffectAnimation(controller.params['guard.sparkno'] ?? controller.params.guardsparkno, player, input, commands, opponent),
    sparkOffset: { x: sparkOffset[0] ?? 0, y: sparkOffset[1] ?? 0 },
    hitSound: parseEffectSound(controller.params.hitsound, player, input, commands, opponent),
    guardSound: parseEffectSound(controller.params.guardsound, player, input, commands, opponent),
    envShake: {
      time: Math.max(0, numValue('envshake.time') ?? 0),
      frequency: numValue('envshake.freq') ?? 60,
      amplitude: numValue('envshake.ampl') ?? -4,
      phase: numValue('envshake.phase') ?? 90,
    },
    hitOnce: boolValue('hitonce') ?? normalizedAttr?.attackTypes.some((value) => value.endsWith('T')) ?? false,
    pauseTime: { attacker: Math.max(0, pause[0] ?? 4), defender: Math.max(0, pause[1] ?? 8) },
    groundVelocity: { x: groundVelocity[0] ?? -3.5, y: groundVelocity[1] ?? 0 },
    airVelocity: { x: airVelocity[0] ?? -2.5, y: airVelocity[1] ?? -5.5 },
    downVelocity: { x: downVelocity[0] ?? airVelocity[0] ?? -2.5, y: downVelocity[1] ?? airVelocity[1] ?? -5.5 },
    downHitTime: nonNegative(numValue('down.hittime')) ?? 20,
    downBounce: boolValue('down.bounce') ?? false,
    attr: normalizedAttr,
    airAnimType: textValue('air.animtype'),
    groundAnimTypeRaw: textValue('animtype'),
    fallAnimType: textValue('fall.animtype'),
    hitFlag: textValue('hitflag')?.toUpperCase() ?? 'MAF',
    guardFlag: textValue('guardflag')?.toUpperCase(),
    priority: { value: priorityValue ?? 4, type: priorityValues[1] === undefined ? 'Hit' : String(priorityValues[1]).trim() },
    guardPauseTime: guardPause[0] === undefined && guardPause[1] === undefined ? undefined : { attacker: Math.max(0, guardPause[0] ?? 0), defender: Math.max(0, guardPause[1] ?? 0) },
    groundType: textValue('ground.type'),
    airType: textValue('air.type'),
    groundHitTime: nonNegative(numValue('ground.hittime')),
    airHitTime: nonNegative(numValue('air.hittime')),
    guardHitTime: nonNegative(numValue('guard.hittime')),
    guardDistance: nonNegative(numValue('guard.dist')),
    groundSlideTime: nonNegative(numValue('ground.slidetime')),
    controlTime: nonNegative(numValue('guard.ctrltime')),
    yAcceleration: numValue('yaccel'),
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
      envShake: {
        time: nonNegative(numValue('fall.envshake.time')) ?? 0,
        frequency: numValue('fall.envshake.freq') ?? 60,
        amplitude: numValue('fall.envshake.ampl') ?? -4,
        phase: numValue('fall.envshake.phase') ?? 90,
      },
    },
    hitId: hitId !== undefined && hitId >= 1 ? hitId : undefined,
    chainId: chainId !== undefined && chainId >= 1 ? chainId : undefined,
    noChainIds: noChainIds.filter((value): value is number => value !== null && value >= 1).slice(0, 2),
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

function formatPowerPair(value: { hit: number; guarded: number } | undefined): string {
  return value ? `${value.hit},${value.guarded}` : '-';
}

function formatCornerPush(value: ActiveHitDef['cornerPush']): string {
  return value ? `${value.ground ?? '-'},${value.air ?? '-'},${value.down ?? '-'},${value.guard ?? '-'},${value.airGuard ?? '-'}` : '-';
}

function formatPoint(value: { x: number; y: number } | undefined): string {
  return value ? `${value.x},${value.y}` : '-';
}

function preserveMoveContact(player: PlayerState, preserveResult: boolean, preserveCount: boolean): PlayerState['moveContact'] {
  const current = player.moveContact;
  if (!current) return undefined;
  if (!preserveResult && !preserveCount) return undefined;
  return {
    activeHitDefId: current.activeHitDefId,
    contact: preserveResult ? current.contact : false,
    hit: preserveResult ? current.hit : false,
    guarded: preserveResult ? current.guarded : false,
    hitCount: preserveCount ? current.hitCount : 0,
  };
}

function formatOptionalBool(value: boolean | undefined): string | number {
  return value === undefined ? '-' : value ? 1 : 0;
}

function parseEffectAnimation(
  value: CnsValue | undefined,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): ActiveHitDef['spark'] {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = evaluateScopedNumber(raw, player, input, commands, opponent);
  return parsed ? { animNo: Math.trunc(parsed.value), scope: parsed.scope } : undefined;
}

function formatEffectAnimation(value: ActiveHitDef['spark']): string {
  return value ? `${value.scope}:${value.animNo}` : '-';
}

function formatEffectSound(value: ActiveHitDef['hitSound']): string {
  return value ? `${value.scope}:${value.group},${value.index}` : '-';
}

function parseEffectSound(
  value: CnsValue | undefined,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): ActiveHitDef['hitSound'] {
  if (value === undefined) return undefined;
  const parts = Array.isArray(value) ? value : String(value).split(',');
  const group = evaluateScopedNumber(parts[0], player, input, commands, opponent);
  const index = cnsValueToNumber(parts[1] ?? '', player, input, commands, opponent);
  if (!group || index === null) return undefined;
  return { group: Math.trunc(group.value), index: Math.trunc(index), scope: group.scope };
}

function evaluateScopedNumber(
  value: string | number | boolean,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): { value: number; scope: 'common' | 'attacker' } | null {
  const raw = String(value).trim();
  const attackerScoped = /^s/i.test(raw);
  const explicitlyCommon = /^f/i.test(raw);
  const expression = attackerScoped || explicitlyCommon ? raw.slice(1) : value;
  const parsed = cnsValueToNumber(expression, player, input, commands, opponent);
  return parsed === null ? null : { value: parsed, scope: attackerScoped ? 'attacker' : 'common' };
}

function formatFall(value: ActiveHitDef['fall']): string {
  if (!value) return '-';
  return `enabled:${value.enabled ?? '-'},anim:${value.animType ?? '-'},velocity:${value.xVelocity ?? '-'},${value.yVelocity ?? '-'},recover:${value.recover ?? '-'},recovertime:${value.recoverTime ?? '-'},damage:${value.damage ?? '-'},kill:${value.kill ?? '-'},envshake:${value.envShake?.time ?? 0},${value.envShake?.frequency ?? '-'},${value.envShake?.amplitude ?? '-'},${value.envShake?.phase ?? '-'}`;
}

function readGroundAnimType(value: CnsValue | undefined): ActiveHitDef['animType'] | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'light') return 'Light';
  if (normalized === 'medium' || normalized === 'med') return 'Medium';
  if (normalized === 'hard' || normalized === 'heavy') return 'Hard';
  if (normalized === 'back') return 'Back';
  if (normalized === 'up') return 'Up';
  if (normalized === 'diagup') return 'DiagUp';
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

function hitAttributeController(
  player: PlayerState,
  controller: CnsStateController,
  mode: 'allow' | 'deny',
  name: 'HitBy' | 'NotHitBy',
): ControllerResult {
  const value2 = str(controller, 'value2');
  const value = value2 ?? str(controller, 'value') ?? str(controller, 'attr');
  if (value === null) return withPlayer(player, false, name);
  const slot = value2 === null ? 0 : 1;
  const slots = [...(player.hitAttributeSlots ?? [null, null])];
  slots[slot] = { mode, value, time: Math.max(0, Math.trunc(num(controller, 'time') ?? 1)) };
  return withPlayer({
    ...player,
    hitAttributeSlots: slots,
  }, true, name);
}

function tickHitAttributeSlots(player: PlayerState): PlayerState {
  if (!player.hitAttributeSlots?.some((slot) => slot && slot.time > 0)) return player;
  const slots = player.hitAttributeSlots.map((slot) => slot && slot.time > 1 ? { ...slot, time: slot.time - 1 } : null);
  return { ...player, hitAttributeSlots: slots };
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

function pair(
  controller: CnsStateController,
  key: string,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
  defaultX: number,
  defaultY: number,
  alias?: string,
): { x: number; y: number } {
  const value = controller.params[key.toLowerCase()] ?? (alias ? controller.params[alias.toLowerCase()] : undefined);
  if (value === undefined) return { x: defaultX, y: defaultY };
  const values = Array.isArray(value) ? value : String(value).split(',').map((part) => part.trim());
  return {
    x: cnsValueToNumber(values[0], player, input, commands, opponent) ?? defaultX,
    y: cnsValueToNumber(values[1], player, input, commands, opponent) ?? defaultY,
  };
}

function triple(
  controller: CnsStateController,
  key: string,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
  defaultRed: number,
  defaultGreen: number,
  defaultBlue: number,
): { red: number; green: number; blue: number } {
  const value = controller.params[key.toLowerCase()];
  if (value === undefined) return { red: defaultRed, green: defaultGreen, blue: defaultBlue };
  const values = Array.isArray(value) ? value : String(value).split(',').map((part) => part.trim());
  return {
    red: cnsValueToNumber(values[0], player, input, commands, opponent) ?? defaultRed,
    green: cnsValueToNumber(values[1], player, input, commands, opponent) ?? defaultGreen,
    blue: cnsValueToNumber(values[2], player, input, commands, opponent) ?? defaultBlue,
  };
}

function optionalPair(
  controller: CnsStateController,
  key: string,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): { x: number; y: number } | null {
  if (controller.params[key.toLowerCase()] === undefined) return null;
  return pair(controller, key, player, input, commands, opponent, 0, 0);
}

function optionalTriple(
  controller: CnsStateController,
  key: string,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): { red: number; green: number; blue: number } | null {
  if (!hasParam(controller, key)) return null;
  return triple(controller, key, player, input, commands, opponent, 0, 0, 0);
}

function optionalNum(
  controller: CnsStateController,
  key: string,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands: ReadonlySet<string> | undefined,
  opponent: PlayerState,
): number | null {
  if (!hasParam(controller, key)) return null;
  return num(controller, key, player, input, commands, opponent);
}

function hasParam(controller: CnsStateController, key: string): boolean {
  return controller.params[key.toLowerCase()] !== undefined;
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
    if (evaluated !== null && Number.isFinite(evaluated)) return evaluated;
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
