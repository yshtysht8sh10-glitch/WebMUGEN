import type { PlayerState } from '../engine/types';

export type CnsRuntimeTriggerContext = {
  player: PlayerState;
  commands?: ReadonlySet<string>;
};

export function evaluateCnsRuntimeTrigger(
  expression: string,
  context: CnsRuntimeTriggerContext,
): boolean {
  const trimmed = normalizeExpression(expression);

  if (trimmed === '1') return true;
  if (trimmed === '0') return false;

  if (trimmed === 'ctrl') {
    return context.player.ctrl;
  }

  const commandMatch = trimmed.match(/^command\s*=\s*"([^"]+)"$/);
  if (commandMatch) {
    return context.commands?.has(commandMatch[1].toLowerCase()) ?? false;
  }

  const timeMatch = trimmed.match(/^time\s*(=|!=|>=|<=|>|<)\s*(-?\d+)$/);
  if (timeMatch) {
    return compareNumber(context.player.stateTime, timeMatch[1], Number(timeMatch[2]));
  }

  const animTimeMatch = trimmed.match(/^animtime\s*(=|!=|>=|<=|>|<)\s*(-?\d+)$/);
  if (animTimeMatch) {
    return compareNumber(context.player.animTime, animTimeMatch[1], Number(animTimeMatch[2]));
  }

  const stateTypeMatch = trimmed.match(/^statetype\s*(=|!=)\s*([a-z])$/);
  if (stateTypeMatch) {
    return compareString(context.player.stateType, stateTypeMatch[1], stateTypeMatch[2].toUpperCase());
  }

  const moveTypeMatch = trimmed.match(/^movetype\s*(=|!=)\s*([a-z])$/);
  if (moveTypeMatch) {
    return compareString(context.player.moveType, moveTypeMatch[1], moveTypeMatch[2].toUpperCase());
  }

  return false;
}

function normalizeExpression(expression: string): string {
  return expression.trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareNumber(actual: number, operator: string, expected: number): boolean {
  switch (operator) {
    case '=':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '>':
      return actual > expected;
    case '>=':
      return actual >= expected;
    case '<':
      return actual < expected;
    case '<=':
      return actual <= expected;
    default:
      return false;
  }
}

function compareString(actual: string, operator: string, expected: string): boolean {
  switch (operator) {
    case '=':
      return actual.toUpperCase() === expected;
    case '!=':
      return actual.toUpperCase() !== expected;
    default:
      return false;
  }
}
