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

export function evaluateCnsRuntimeTriggerGroup(
  expressions: readonly string[],
  context: CnsRuntimeTriggerContext,
): boolean {
  if (expressions.length === 0) {
    return true;
  }

  const groups = new Map<number, string[]>();

  for (const expression of expressions) {
    const match = expression.match(/^trigger(\d+)(?:all)?\s*:\s*(.*)$/i);
    if (!match) {
      const existing = groups.get(1) ?? [];
      existing.push(expression);
      groups.set(1, existing);
      continue;
    }

    const groupNo = Number(match[1]);
    const body = match[2];
    const existing = groups.get(groupNo) ?? [];
    existing.push(body);
    groups.set(groupNo, existing);
  }

  return Array.from(groups.values()).some((group) =>
    group.every((expression) => evaluateCnsRuntimeTrigger(expression, context)),
  );
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
