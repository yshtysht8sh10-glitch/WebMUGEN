import type { PlayerInput, PlayerState } from './types';
import type { TriggerExpression } from '../../parser/cns/TriggerExpression';

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

    case 'movehit':
      return context.moveHit;

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

  const commandActive = isCommandActive(expression.right.value, input);

  if (expression.operator === '=') {
    return commandActive;
  }

  if (expression.operator === '!=') {
    return !commandActive;
  }

  return false;
}

function isCommandActive(commandName: string, input: PlayerInput): boolean {
  switch (commandName) {
    case 'holdfwd':
      return input.right;

    case 'holdback':
      return input.left;

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
