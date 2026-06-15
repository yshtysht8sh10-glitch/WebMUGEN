import type {
  CnsDocument,
  CnsStateController,
  CnsStateDefinition,
  CnsTrigger,
  CnsValue,
} from '../../mugen/common/cnsTypes';
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

export type CnsRuntimeResult = {
  state: GameState;
  traces: CnsRuntimeTrace[];
};

export function stepCnsStateRuntime(
  state: GameState,
  cnsDocument?: CnsDocument | null,
  input: CnsRuntimeInput = {},
): CnsRuntimeResult {
  if (!cnsDocument) {
    return {
      state,
      traces: [
        createMissingTrace(1, state.players[0], input),
        createMissingTrace(2, state.players[1], input),
      ],
    };
  }

  const p1Result = stepPlayerCnsRuntime(state.players[0], 1, cnsDocument, input, input.p1Commands);
  const intermediateState: GameState = {
    ...state,
    players: [p1Result.player, state.players[1]],
  };

  const p2Result = stepPlayerCnsRuntime(
    intermediateState.players[1],
    2,
    cnsDocument,
    input,
    input.p2Commands,
  );

  return {
    state: {
      ...intermediateState,
      players: [intermediateState.players[0], p2Result.player],
    },
    traces: [p1Result.trace, p2Result.trace],
  };
}

function stepPlayerCnsRuntime(
  player: PlayerState,
  playerId: 1 | 2,
  cnsDocument: CnsDocument,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): { player: PlayerState; trace: CnsRuntimeTrace } {
  const stateDef = findStateDef(cnsDocument, player.stateNo);
  const trace: CnsRuntimeTrace = {
    playerId,
    stateNo: player.stateNo,
    afterStateNo: player.stateNo,
    animNo: player.animNo,
    afterAnimNo: player.animNo,
    stateTime: player.stateTime,
    afterStateTime: player.stateTime,
    mugenAnimTime: getMugenAnimTime(player, input),
    stateFound: Boolean(stateDef),
    executedControllers: [],
  };

  if (!stateDef) {
    return { player, trace };
  }

  let nextPlayer = applyStateDefHeader(player, stateDef, { resetAnimOnChange: false });

  for (const controller of stateDef.controllers) {
    if (!shouldRunController(controller, nextPlayer, input, commands)) {
      continue;
    }

    const result = executeSupportedController(nextPlayer, controller, cnsDocument);
    nextPlayer = result.player;

    if (result.executed) {
      trace.executedControllers.push(result.name);
    }
  }

  trace.afterStateNo = nextPlayer.stateNo;
  trace.afterAnimNo = nextPlayer.animNo;
  trace.afterStateTime = nextPlayer.stateTime;

  return { player: nextPlayer, trace };
}

function findStateDef(cnsDocument: CnsDocument, stateNo: number): CnsStateDefinition | undefined {
  return cnsDocument.states.find((state) => state.stateNo === stateNo);
}

function applyStateDefHeader(
  player: PlayerState,
  stateDef: CnsStateDefinition,
  options: { resetAnimOnChange: boolean },
): PlayerState {
  const nextAnimNo = stateDef.initialAnim ?? player.animNo;
  const animChanged = player.animNo !== nextAnimNo;

  return {
    ...player,
    stateType: stateDef.stateType ?? player.stateType,
    moveType: stateDef.moveType ?? player.moveType,
    physics: stateDef.physics ?? player.physics,
    ctrl: stateDef.ctrl ?? player.ctrl,
    animNo: nextAnimNo,
    animTime: options.resetAnimOnChange && animChanged ? 0 : player.animTime,
  };
}

function shouldRunController(
  controller: CnsStateController,
  player: PlayerState,
  input: CnsRuntimeInput,
  commands?: ReadonlySet<string>,
): boolean {
  if (controller.triggers.length === 0) {
    return true;
  }

  return evaluateCnsRuntimeTriggerGroup(
    controller.triggers.map(formatTriggerForRuntime),
    {
      player,
      commands,
      animTime: getMugenAnimTime(player, input),
    },
  );
}

function getMugenAnimTime(player: PlayerState, input: CnsRuntimeInput): number {
  const duration = input.getAnimationDuration?.(player.animNo) ?? null;
  return calculateMugenAnimTime(player.animTime, duration);
}

function formatTriggerForRuntime(trigger: CnsTrigger): string {
  return `${trigger.name}: ${trigger.expression}`;
}

function executeSupportedController(
  player: PlayerState,
  controller: CnsStateController,
  cnsDocument: CnsDocument,
): { player: PlayerState; executed: boolean; name: string } {
  const type = controller.type.toLowerCase();

  if (type === 'changeanim') {
    const value = readNumber(controller, 'value');
    if (value === null) return { player, executed: false, name: 'ChangeAnim' };

    return {
      player: {
        ...player,
        animNo: value,
        animTime: player.animNo === value ? player.animTime : 0,
      },
      executed: true,
      name: 'ChangeAnim',
    };
  }

  if (type === 'velset') {
    const x = readNumber(controller, 'x');
    const y = readNumber(controller, 'y');

    return {
      player: { ...player, vx: x ?? player.vx, vy: y ?? player.vy },
      executed: x !== null || y !== null,
      name: 'VelSet',
    };
  }

  if (type === 'veladd') {
    const x = readNumber(controller, 'x');
    const y = readNumber(controller, 'y');

    return {
      player: {
        ...player,
        vx: x !== null ? player.vx + x : player.vx,
        vy: y !== null ? player.vy + y : player.vy,
      },
      executed: x !== null || y !== null,
      name: 'VelAdd',
    };
  }

  if (type === 'posset') {
    const x = readNumber(controller, 'x');
    const y = readNumber(controller, 'y');

    return {
      player: { ...player, x: x ?? player.x, y: y ?? player.y },
      executed: x !== null || y !== null,
      name: 'PosSet',
    };
  }

  if (type === 'posadd') {
    const x = readNumber(controller, 'x');
    const y = readNumber(controller, 'y');

    return {
      player: {
        ...player,
        x: x !== null ? player.x + x : player.x,
        y: y !== null ? player.y + y : player.y,
      },
      executed: x !== null || y !== null,
      name: 'PosAdd',
    };
  }

  if (type === 'ctrlset') {
    const value = readNumber(controller, 'value');
    if (value === null) return { player, executed: false, name: 'CtrlSet' };

    return {
      player: { ...player, ctrl: value !== 0 },
      executed: true,
      name: 'CtrlSet',
    };
  }

  if (type === 'statetypeset') {
    const stateType = readString(controller, 'statetype');
    const moveType = readString(controller, 'movetype');
    const physics = readString(controller, 'physics');

    return {
      player: {
        ...player,
        stateType: toStateType(stateType) ?? player.stateType,
        moveType: toMoveType(moveType) ?? player.moveType,
        physics: toPhysics(physics) ?? player.physics,
      },
      executed: stateType !== null || moveType !== null || physics !== null,
      name: 'StateTypeSet',
    };
  }

  if (type === 'movetypeset') {
    const value = readString(controller, 'value') ?? readString(controller, 'movetype');
    const moveType = toMoveType(value);

    if (!moveType) return { player, executed: false, name: 'MoveTypeSet' };

    return {
      player: { ...player, moveType },
      executed: true,
      name: 'MoveTypeSet',
    };
  }

  if (type === 'lifeadd') {
    const value = readNumber(controller, 'value');
    if (value === null) return { player, executed: false, name: 'LifeAdd' };

    return {
      player: { ...player, life: Math.max(0, player.life + value) },
      executed: true,
      name: 'LifeAdd',
    };
  }

  if (type === 'poweradd') {
    const value = readNumber(controller, 'value');
    if (value === null) return { player, executed: false, name: 'PowerAdd' };

    return {
      player: { ...player, power: Math.max(0, player.power + value) },
      executed: true,
      name: 'PowerAdd',
    };
  }

  if (type === 'varset') {
    const index = readNumber(controller, 'v');
    const value = readNumber(controller, 'value');
    if (index === null || value === null) return { player, executed: false, name: 'VarSet' };

    return {
      player: setPlayerVar(player, index, value),
      executed: true,
      name: 'VarSet',
    };
  }

  if (type === 'varadd') {
    const index = readNumber(controller, 'v');
    const value = readNumber(controller, 'value');
    if (index === null || value === null) return { player, executed: false, name: 'VarAdd' };

    const current = getPlayerVar(player, index);
    return {
      player: setPlayerVar(player, index, current + value),
      executed: true,
      name: 'VarAdd',
    };
  }

  if (type === 'changestate') {
    const value = readNumber(controller, 'value');
    if (value === null) return { player, executed: false, name: 'ChangeState' };

    const changedPlayer: PlayerState = {
      ...player,
      stateNo: value,
      stateTime: player.stateNo === value ? player.stateTime : 0,
    };

    const destinationStateDef = findStateDef(cnsDocument, value);

    return {
      player: destinationStateDef
        ? applyStateDefHeader(changedPlayer, destinationStateDef, { resetAnimOnChange: true })
        : changedPlayer,
      executed: true,
      name: 'ChangeState',
    };
  }

  return { player, executed: false, name: controller.type };
}

function readNumber(controller: CnsStateController, key: string): number | null {
  return cnsValueToNumber(controller.params[key.toLowerCase()]);
}

function readString(controller: CnsStateController, key: string): string | null {
  const value = controller.params[key.toLowerCase()];
  if (value === undefined || value === null) return null;
  return String(value).trim();
}

function cnsValueToNumber(value: CnsValue | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;

  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toStateType(value: string | null): PlayerState['stateType'] | null {
  const normalized = value?.toUpperCase();
  if (normalized === 'S' || normalized === 'C' || normalized === 'A') return normalized;
  return null;
}

function toMoveType(value: string | null): PlayerState['moveType'] | null {
  const normalized = value?.toUpperCase();
  if (normalized === 'I' || normalized === 'A' || normalized === 'H') return normalized;
  return null;
}

function toPhysics(value: string | null): PlayerState['physics'] | null {
  const normalized = value?.toUpperCase();
  if (normalized === 'S' || normalized === 'C' || normalized === 'A' || normalized === 'N') return normalized;
  return null;
}

function getPlayerVar(player: PlayerState, index: number): number {
  return (player.vars?.[index] as number | undefined) ?? 0;
}

function setPlayerVar(player: PlayerState, index: number, value: number): PlayerState {
  return {
    ...player,
    vars: {
      ...player.vars,
      [index]: value,
    },
  };
}

function createMissingTrace(playerId: 1 | 2, player: PlayerState, input: CnsRuntimeInput): CnsRuntimeTrace {
  return {
    playerId,
    stateNo: player.stateNo,
    afterStateNo: player.stateNo,
    animNo: player.animNo,
    afterAnimNo: player.animNo,
    stateTime: player.stateTime,
    afterStateTime: player.stateTime,
    mugenAnimTime: getMugenAnimTime(player, input),
    stateFound: false,
    executedControllers: [],
  };
}
