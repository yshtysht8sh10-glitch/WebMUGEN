import type {
  CnsDocument,
  CnsStateController,
  CnsStateDefinition,
  CnsValue,
} from '../../mugen/common/cnsTypes';
import type { GameState, PlayerState } from '../engine/types';
import { evaluateCnsRuntimeTrigger } from './CnsRuntimeTrigger';

export type CnsRuntimeTrace = {
  playerId: 1 | 2;
  stateNo: number;
  stateFound: boolean;
  executedControllers: string[];
};

export type CnsRuntimeInput = {
  p1Commands?: ReadonlySet<string>;
  p2Commands?: ReadonlySet<string>;
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
        createMissingTrace(1, state.players[0].stateNo),
        createMissingTrace(2, state.players[1].stateNo),
      ],
    };
  }

  const p1Result = stepPlayerCnsRuntime(
    state.players[0],
    1,
    cnsDocument,
    input.p1Commands,
  );
  const intermediateState: GameState = {
    ...state,
    players: [p1Result.player, state.players[1]],
  };

  const p2Result = stepPlayerCnsRuntime(
    intermediateState.players[1],
    2,
    cnsDocument,
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
  commands?: ReadonlySet<string>,
): { player: PlayerState; trace: CnsRuntimeTrace } {
  const stateDef = findStateDef(cnsDocument, player.stateNo);
  const trace: CnsRuntimeTrace = {
    playerId,
    stateNo: player.stateNo,
    stateFound: Boolean(stateDef),
    executedControllers: [],
  };

  if (!stateDef) {
    return { player, trace };
  }

  let nextPlayer = applyStateDefHeader(player, stateDef);

  for (const controller of stateDef.controllers) {
    if (!shouldRunController(controller, nextPlayer, commands)) {
      continue;
    }

    const result = executeSupportedController(nextPlayer, controller);
    nextPlayer = result.player;

    if (result.executed) {
      trace.executedControllers.push(result.name);
    }
  }

  return { player: nextPlayer, trace };
}

function findStateDef(cnsDocument: CnsDocument, stateNo: number): CnsStateDefinition | undefined {
  return cnsDocument.states.find((state) => state.stateNo === stateNo);
}

function applyStateDefHeader(player: PlayerState, stateDef: CnsStateDefinition): PlayerState {
  return {
    ...player,
    stateType: stateDef.stateType ?? player.stateType,
    moveType: stateDef.moveType ?? player.moveType,
    physics: stateDef.physics ?? player.physics,
    ctrl: stateDef.ctrl ?? player.ctrl,
    animNo: stateDef.initialAnim ?? player.animNo,
  };
}

function shouldRunController(
  controller: CnsStateController,
  player: PlayerState,
  commands?: ReadonlySet<string>,
): boolean {
  if (controller.triggers.length === 0) {
    return true;
  }

  return controller.triggers.some((trigger) =>
    evaluateCnsRuntimeTrigger(trigger.expression, {
      player,
      commands,
    }),
  );
}

function executeSupportedController(
  player: PlayerState,
  controller: CnsStateController,
): { player: PlayerState; executed: boolean; name: string } {
  const type = controller.type.toLowerCase();

  if (type === 'changeanim') {
    const value = readNumber(controller, 'value');
    if (value === null) {
      return { player, executed: false, name: 'ChangeAnim' };
    }

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
      player: {
        ...player,
        vx: x ?? player.vx,
        vy: y ?? player.vy,
      },
      executed: x !== null || y !== null,
      name: 'VelSet',
    };
  }

  if (type === 'posset') {
    const x = readNumber(controller, 'x');
    const y = readNumber(controller, 'y');

    return {
      player: {
        ...player,
        x: x ?? player.x,
        y: y ?? player.y,
      },
      executed: x !== null || y !== null,
      name: 'PosSet',
    };
  }

  if (type === 'changestate') {
    const value = readNumber(controller, 'value');
    if (value === null) {
      return { player, executed: false, name: 'ChangeState' };
    }

    return {
      player: {
        ...player,
        stateNo: value,
        stateTime: player.stateNo === value ? player.stateTime : 0,
      },
      executed: true,
      name: 'ChangeState',
    };
  }

  return {
    player,
    executed: false,
    name: controller.type,
  };
}

function readNumber(controller: CnsStateController, key: string): number | null {
  const value = controller.params[key.toLowerCase()];
  return cnsValueToNumber(value);
}

function cnsValueToNumber(value: CnsValue | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function createMissingTrace(playerId: 1 | 2, stateNo: number): CnsRuntimeTrace {
  return {
    playerId,
    stateNo,
    stateFound: false,
    executedControllers: [],
  };
}
