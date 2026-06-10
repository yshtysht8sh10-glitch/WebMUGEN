import type { CnsStateController } from '../../mugen/common/cnsTypes';
import type { PlayerInput, PlayerState } from './types';
import { parseTriggerExpression } from '../../parser/cns/TriggerParser';
import { evaluateTriggerAsBoolean } from './TriggerEvaluator';

export type ControllerExecutionContext = {
  input: PlayerInput;
  animLength: number;
  moveHit: boolean;
};

export type ControllerExecutionResult = {
  player: PlayerState;
  changedState: boolean;
  velocityChanged: boolean;
};

const DEFAULT_GRAVITY = 0.45;

export function executeControllers(
  player: PlayerState,
  controllers: CnsStateController[],
  context: ControllerExecutionContext,
): ControllerExecutionResult {
  let currentPlayer = player;
  let velocityChanged = false;

  for (const controller of controllers) {
    if (!shouldExecuteController(currentPlayer, controller, context)) {
      continue;
    }

    const result = executeController(currentPlayer, controller);
    currentPlayer = result.player;
    velocityChanged = velocityChanged || result.velocityChanged;

    if (result.changedState) {
      return {
        player: currentPlayer,
        changedState: true,
        velocityChanged,
      };
    }
  }

  return {
    player: currentPlayer,
    changedState: false,
    velocityChanged,
  };
}

function shouldExecuteController(
  player: PlayerState,
  controller: CnsStateController,
  context: ControllerExecutionContext,
): boolean {
  if (controller.triggers.length === 0) {
    return true;
  }

  return controller.triggers.every((trigger) =>
    evaluateTriggerAsBoolean(parseTriggerExpression(trigger.expression), {
      player,
      input: context.input,
      animLength: context.animLength,
      moveHit: context.moveHit,
    }),
  );
}

export function executeController(
  player: PlayerState,
  controller: CnsStateController,
): ControllerExecutionResult {
  const controllerType = controller.type.toLowerCase();

  switch (controllerType) {
    case 'changestate':
      return executeChangeState(player, controller);

    case 'velset':
      return {
        player: executeVelSet(player, controller),
        changedState: false,
        velocityChanged: true,
      };

    case 'posadd':
      return {
        player: executePosAdd(player, controller),
        changedState: false,
        velocityChanged: false,
      };

    case 'ctrlset':
      return {
        player: executeCtrlSet(player, controller),
        changedState: false,
        velocityChanged: false,
      };

    case 'changeanim':
      return {
        player: executeChangeAnim(player, controller),
        changedState: false,
        velocityChanged: false,
      };

    case 'statetypeset':
      return {
        player: executeStateTypeSet(player, controller),
        changedState: false,
        velocityChanged: false,
      };

    case 'gravity':
      return {
        player: executeGravity(player, controller),
        changedState: false,
        velocityChanged: true,
      };

    default:
      return {
        player,
        changedState: false,
        velocityChanged: false,
      };
  }
}

function executeChangeState(
  player: PlayerState,
  controller: CnsStateController,
): ControllerExecutionResult {
  const stateNo = readNumber(controller, 'value', player.stateNo);
  const ctrl = readOptionalBoolean(controller, 'ctrl');

  return {
    player: {
      ...player,
      stateNo,
      stateTime: 0,
      animNo: stateNo,
      animTime: 0,
      ctrl: ctrl ?? player.ctrl,
    },
    changedState: true,
    velocityChanged: false,
  };
}

function executeVelSet(player: PlayerState, controller: CnsStateController): PlayerState {
  return {
    ...player,
    vx: readNumber(controller, 'x', player.vx),
    vy: readNumber(controller, 'y', player.vy),
  };
}

function executePosAdd(player: PlayerState, controller: CnsStateController): PlayerState {
  return {
    ...player,
    x: player.x + readNumber(controller, 'x', 0),
    y: player.y + readNumber(controller, 'y', 0),
  };
}

function executeCtrlSet(player: PlayerState, controller: CnsStateController): PlayerState {
  return {
    ...player,
    ctrl: readNumber(controller, 'value', player.ctrl ? 1 : 0) !== 0,
  };
}

function executeChangeAnim(player: PlayerState, controller: CnsStateController): PlayerState {
  const animNo = readNumber(controller, 'value', player.animNo);

  if (animNo === player.animNo) {
    return player;
  }

  return {
    ...player,
    animNo,
    animTime: 0,
  };
}

function executeStateTypeSet(player: PlayerState, controller: CnsStateController): PlayerState {
  return {
    ...player,
    stateType: readString(controller, 'statetype', player.stateType) as PlayerState['stateType'],
    moveType: readString(controller, 'movetype', player.moveType) as PlayerState['moveType'],
    physics: readString(controller, 'physics', player.physics) as PlayerState['physics'],
  };
}

function executeGravity(player: PlayerState, controller: CnsStateController): PlayerState {
  return {
    ...player,
    vy: player.vy + readNumber(controller, 'y', DEFAULT_GRAVITY),
  };
}

function readNumber(
  controller: CnsStateController,
  key: string,
  fallback: number,
): number {
  const value = controller.params[key];

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? fallback : numericValue;
  }

  return fallback;
}

function readString(
  controller: CnsStateController,
  key: string,
  fallback: string,
): string {
  const value = controller.params[key];

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return fallback;
}

function readOptionalBoolean(
  controller: CnsStateController,
  key: string,
): boolean | undefined {
  const value = controller.params[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    return value !== '0';
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return undefined;
}
