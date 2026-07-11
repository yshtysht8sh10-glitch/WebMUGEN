import type { CnsStateController, CnsValue } from '../../mugen/common/cnsTypes';
import type { ActiveHitDef, PlayerInput, PlayerState, ProjectileState } from './types';
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
  projectiles: ProjectileState[];
};

const DEFAULT_GRAVITY = 0.45;

export function executeControllers(
  player: PlayerState,
  controllers: CnsStateController[],
  context: ControllerExecutionContext,
): ControllerExecutionResult {
  let currentPlayer = player;
  let velocityChanged = false;
  const projectiles: ProjectileState[] = [];

  for (const controller of controllers) {
    if (!shouldExecuteController(currentPlayer, controller, context)) {
      continue;
    }

    const result = executeController(currentPlayer, controller);
    currentPlayer = result.player;
    velocityChanged = velocityChanged || result.velocityChanged;
    projectiles.push(...result.projectiles);

    if (result.changedState) {
      return {
        player: currentPlayer,
        changedState: true,
        velocityChanged,
        projectiles,
      };
    }
  }

  return {
    player: currentPlayer,
    changedState: false,
    velocityChanged,
    projectiles,
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
      return withNoProjectile(executeChangeState(player, controller));

    case 'velset':
      return {
        player: executeVelSet(player, controller),
        changedState: false,
        velocityChanged: true,
        projectiles: [],
      };

    case 'velmul':
      return {
        player: executeVelMul(player, controller),
        changedState: false,
        velocityChanged: true,
        projectiles: [],
      };

    case 'posadd':
      return {
        player: executePosAdd(player, controller),
        changedState: false,
        velocityChanged: false,
        projectiles: [],
      };

    case 'ctrlset':
      return {
        player: executeCtrlSet(player, controller),
        changedState: false,
        velocityChanged: false,
        projectiles: [],
      };

    case 'playerpush':
      return {
        player: {
          ...player,
          playerPush: readOptionalBoolean(controller, 'value') ?? true,
        },
        changedState: false,
        velocityChanged: false,
        projectiles: [],
      };

    case 'changeanim':
      return {
        player: executeChangeAnim(player, controller),
        changedState: false,
        velocityChanged: false,
        projectiles: [],
      };

    case 'statetypeset':
      return {
        player: executeStateTypeSet(player, controller),
        changedState: false,
        velocityChanged: false,
        projectiles: [],
      };

    case 'gravity':
      return {
        player: executeGravity(player, controller),
        changedState: false,
        velocityChanged: true,
        projectiles: [],
      };

    case 'hitdef':
      return {
        player: executeHitDef(player, controller),
        changedState: false,
        velocityChanged: false,
        projectiles: [],
      };

    case 'projectile':
      return executeProjectile(player, controller);

    default:
      return {
        player,
        changedState: false,
        velocityChanged: false,
        projectiles: [],
      };
  }
}

function withNoProjectile(result: Omit<ControllerExecutionResult, 'projectiles'>): ControllerExecutionResult {
  return {
    ...result,
    projectiles: [],
  };
}

function executeChangeState(
  player: PlayerState,
  controller: CnsStateController,
): Omit<ControllerExecutionResult, 'projectiles'> {
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
      activeHitDef: null,
      hitDefUsed: false,
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

function executeVelMul(player: PlayerState, controller: CnsStateController): PlayerState {
  return {
    ...player,
    vx: player.vx * readNumber(controller, 'x', 1),
    vy: player.vy * readNumber(controller, 'y', 1),
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
  return animNo === player.animNo ? player : { ...player, animNo, animTime: 0 };
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

function executeHitDef(player: PlayerState, controller: CnsStateController): PlayerState {
  return {
    ...player,
    activeHitDef: readHitDef(controller),
    hitDefUsed: false,
  };
}

function executeProjectile(
  player: PlayerState,
  controller: CnsStateController,
): ControllerExecutionResult {
  const velocity = readNumberPair(controller.params.velocity, 5, 0);
  const offset = readNumberPair(controller.params.offset, 42, -44);
  const damage = readNumberPair(controller.params.damage, 70, 10);
  const groundVelocity = readNumberPair(controller.params['ground.velocity'], -4, 0);
  const airVelocity = readNumberPair(controller.params['air.velocity'], -2.5, -5.5);
  const pauseTime = readNumberPair(controller.params.pausetime, 4, 10);

  const projectile: ProjectileState = {
    id: readNumber(controller, 'projid', 1000),
    ownerId: player.id,
    x: player.x + player.facing * offset[0],
    y: player.y + offset[1],
    vx: player.facing * Math.abs(velocity[0]),
    vy: velocity[1],
    facing: player.facing,
    animNo: readNumber(controller, 'projanim', 1100),
    animTime: 0,
    lifeTime: 0,
    removeTime: readNumber(controller, 'removetime', 90),
    hitDef: {
      damage: damage[0],
      guardDamage: damage[1],
      pauseTime: { attacker: pauseTime[0], defender: pauseTime[1] },
      groundVelocity: { x: groundVelocity[0], y: groundVelocity[1] },
      airVelocity: { x: airVelocity[0], y: airVelocity[1] },
    },
    hitBox: { x: -12, y: -12, width: 24, height: 24 },
  };

  return {
    player,
    changedState: false,
    velocityChanged: false,
    projectiles: [projectile],
  };
}

function readHitDef(controller: CnsStateController): ActiveHitDef {
  const damage = readNumberPair(controller.params.damage, 30, 0);
  const pauseTime = readNumberPair(controller.params.pausetime, 8, 8);
  const groundVelocity = readNumberPair(controller.params['ground.velocity'], -3.5, 0);
  const airVelocity = readNumberPair(controller.params['air.velocity'], -2.5, -5.5);

  return {
    damage: damage[0],
    guardDamage: damage[1],
    pauseTime: { attacker: pauseTime[0], defender: pauseTime[1] },
    groundVelocity: { x: groundVelocity[0], y: groundVelocity[1] },
    airVelocity: { x: airVelocity[0], y: airVelocity[1] },
  };
}

function readNumber(controller: CnsStateController, key: string, fallback: number): number {
  const value = controller.params[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? fallback : numericValue;
  }
  return fallback;
}

function readString(controller: CnsStateController, key: string, fallback: string): string {
  const value = controller.params[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function readNumberPair(value: CnsValue | undefined, fallback0: number, fallback1: number): [number, number] {
  if (Array.isArray(value)) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    return [Number.isNaN(first) ? fallback0 : first, Number.isNaN(second) ? fallback1 : second];
  }
  if (typeof value === 'number') return [value, fallback1];
  if (typeof value === 'string') {
    const numericValue = Number(value);
    return [Number.isNaN(numericValue) ? fallback0 : numericValue, fallback1];
  }
  return [fallback0, fallback1];
}

function readOptionalBoolean(controller: CnsStateController, key: string): boolean | undefined {
  const value = controller.params[key];
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value !== '0';
  if (typeof value === 'boolean') return value;
  return undefined;
}
