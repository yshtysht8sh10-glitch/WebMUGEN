import type { PlayerInput, PlayerState } from './types';
import type { TriggerExpression } from '../../parser/cns/TriggerExpression';
import { DEFAULT_GROUND_Y } from './GroundClamp';

export type TriggerEvaluationContext = {
  player: PlayerState;
  input: PlayerInput;
  animLength: number;
  moveHit: boolean;
};

export function evaluateTriggerExpression(
  expression: TriggerExpression,
  context: TriggerEvaluationContext,
): boolean | number | string {
  switch (expression.kind) {
    case 'Boolean':
      return expression.value;

    case 'NumberLiteral':
      return expression.value;

    case 'StringLiteral':
      return expression.value;

    case 'Identifier':
      return evaluateIdentifier(expression.name, context);

    case 'Binary': {
      const left = evaluateTriggerExpression(expression.left, context);
      const right = evaluateTriggerExpression(expression.right, context);
      return evaluateBinary(expression.operator, left, right);
    }
  }
}

function evaluateIdentifier(
  name: string,
  context: TriggerEvaluationContext,
): boolean | number | string {
  switch (name.toLowerCase()) {
    case 'time':
      return context.player.stateTime;

    case 'animtime':
      return context.player.animTime >= context.animLength ? 0 : -1;

    case 'ctrl':
      return context.player.ctrl;

    case 'statetype':
      return context.player.stateType;

    case 'movetype':
      return context.player.moveType;

    case 'physics':
      return context.player.physics;

    case 'movehit':
      return context.moveHit;

    case 'pos x':
      return context.player.x;

    case 'pos y':
      return context.player.y - DEFAULT_GROUND_Y;

    case 'vel x':
      return context.player.vx;

    case 'vel y':
      return context.player.vy;

    case 'command':
      return '';

    default:
      return '';
  }
}

function evaluateBinary(
  operator: string,
  left: boolean | number | string,
  right: boolean | number | string,
): boolean {
  switch (operator) {
    case '=':
      return left === right;

    case '!=':
      return left !== right;

    case '>':
      return Number(left) > Number(right);

    case '<':
      return Number(left) < Number(right);

    case '>=':
      return Number(left) >= Number(right);

    case '<=':
      return Number(left) <= Number(right);

    default:
      return false;
  }
}

export function evaluateCommandTrigger(
  expression: TriggerExpression,
  input: PlayerInput,
): boolean | null {
  if (expression.kind !== 'Binary') {
    return null;
  }

  if (expression.left.kind !== 'Identifier' || expression.left.name !== 'command') {
    return null;
  }

  if (expression.right.kind !== 'StringLiteral') {
    return null;
  }

  const commandName = expression.right.value.toLowerCase();
  const commandActive = input.commandNames
    ? hasCommandName(input.commandNames, commandName)
    : isLegacyCommandActive(commandName, input);

  if (expression.operator === '=') {
    return commandActive;
  }

  if (expression.operator === '!=') {
    return !commandActive;
  }

  return false;
}

function hasCommandName(commands: ReadonlySet<string>, commandName: string): boolean {
  if (commands.has(commandName)) {
    return true;
  }

  return Array.from(commands).some((command) => command.toLowerCase() === commandName);
}

function isLegacyCommandActive(commandName: string, input: PlayerInput): boolean {
  switch (commandName) {
    case 'holdfwd':
      return input.right;

    case 'holdback':
      return input.left;

    case 'holdup':
      return input.up ?? false;

    case 'holddown':
      return input.down ?? false;

    case 'holdfwd_up':
      return input.right && (input.up ?? false);

    case 'holdback_up':
      return input.left && (input.up ?? false);

    case 'a':
      return input.attack;

    default:
      return false;
  }
}

export function evaluateTriggerAsBoolean(
  expression: TriggerExpression,
  context: TriggerEvaluationContext,
): boolean {
  const commandResult = evaluateCommandTrigger(expression, context.input);
  if (commandResult !== null) {
    return commandResult;
  }

  const result = evaluateTriggerExpression(expression, context);

  if (typeof result === 'boolean') {
    return result;
  }

  if (typeof result === 'number') {
    return result !== 0;
  }

  return result.length > 0;
}
