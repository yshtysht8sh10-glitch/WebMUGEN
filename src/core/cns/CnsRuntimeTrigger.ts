import type { PlayerState } from '../engine/types';

export type CnsRuntimeTriggerContext = {
  player: PlayerState;
  commands?: ReadonlySet<string>;
  animTime?: number;
};

export function evaluateCnsRuntimeTrigger(
  expression: string,
  context: CnsRuntimeTriggerContext,
): boolean {
  const trimmed = normalizeExpression(expression);

  if (trimmed === '1') return true;
  if (trimmed === '0') return false;

  if (trimmed === 'ctrl') return context.player.ctrl;

  const commandMatch = trimmed.match(/^command\s*(=|!=)\s*\"([^\"]+)\"$/);
  if (commandMatch) {
    const active = context.commands?.has(commandMatch[2].toLowerCase()) ?? false;
    return commandMatch[1] === '=' ? active : !active;
  }

  const timeMatch = trimmed.match(/^time\s*(=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (timeMatch) return compareNumber(context.player.stateTime, timeMatch[1], Number(timeMatch[2]));

  const animTimeMatch = trimmed.match(/^animtime\s*(=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (animTimeMatch) {
    return compareNumber(context.animTime ?? context.player.animTime, animTimeMatch[1], Number(animTimeMatch[2]));
  }

  const animMatch = trimmed.match(/^anim\s*(=|!=|>=|<=|>|<)\s*(-?\d+)$/);
  if (animMatch) return compareNumber(context.player.animNo, animMatch[1], Number(animMatch[2]));

  const stateNoMatch = trimmed.match(/^stateno\s*(=|!=|>=|<=|>|<)\s*(-?\d+)$/);
  if (stateNoMatch) return compareNumber(context.player.stateNo, stateNoMatch[1], Number(stateNoMatch[2]));

  const powerMatch = trimmed.match(/^power\s*(=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (powerMatch) return compareNumber(context.player.power ?? 0, powerMatch[1], Number(powerMatch[2]));

  const posMatch = trimmed.match(/^pos\s+([xy])\s*(=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (posMatch) {
    const actual = posMatch[1] === 'x' ? context.player.x : context.player.y;
    return compareNumber(actual, posMatch[2], Number(posMatch[3]));
  }

  const velMatch = trimmed.match(/^vel\s+([xy])\s*(=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (velMatch) {
    const actual = velMatch[1] === 'x' ? context.player.vx : context.player.vy;
    return compareNumber(actual, velMatch[2], Number(velMatch[3]));
  }

  const animelemMatch = trimmed.match(/^animelem\s*=\s*(\d+)$/);
  if (animelemMatch) return context.player.animTime === Number(animelemMatch[1]);

  const animelemTimeMatch = trimmed.match(/^animelemtime\s*\(\s*(\d+)\s*\)\s*(=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (animelemTimeMatch) {
    const elemNo = Number(animelemTimeMatch[1]);
    const relativeTime = context.player.animTime - elemNo;
    return compareNumber(relativeTime, animelemTimeMatch[2], Number(animelemTimeMatch[3]));
  }

  const stateTypeMatch = trimmed.match(/^statetype\s*(=|!=)\s*([sca])$/);
  if (stateTypeMatch) return compareString(context.player.stateType, stateTypeMatch[1], stateTypeMatch[2].toUpperCase());

  const moveTypeMatch = trimmed.match(/^movetype\s*(=|!=)\s*([aih])$/);
  if (moveTypeMatch) return compareString(context.player.moveType, moveTypeMatch[1], moveTypeMatch[2].toUpperCase());

  const facingMatch = trimmed.match(/^facing\s*(=|!=|>=|<=|>|<)\s*(-?1)$/);
  if (facingMatch) return compareNumber(context.player.facing, facingMatch[1], Number(facingMatch[2]));

  return false;
}

export function evaluateCnsRuntimeTriggerGroup(
  expressions: readonly string[],
  context: CnsRuntimeTriggerContext,
): boolean {
  if (expressions.length === 0) return true;

  const triggerAll: string[] = [];
  const groups = new Map<number, string[]>();

  for (const expression of expressions) {
    const triggerAllMatch = expression.match(/^triggerall\s*:\s*(.*)$/i);
    if (triggerAllMatch) {
      triggerAll.push(triggerAllMatch[1]);
      continue;
    }

    const match = expression.match(/^trigger(\d+)\s*:\s*(.*)$/i);
    const groupNo = match ? Number(match[1]) : 1;
    const body = match ? match[2] : expression;
    const existing = groups.get(groupNo) ?? [];
    existing.push(body);
    groups.set(groupNo, existing);
  }

  if (!triggerAll.every((expression) => evaluateCnsRuntimeTrigger(expression, context))) {
    return false;
  }

  if (groups.size === 0) {
    return triggerAll.length > 0;
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
    case '=': return actual === expected;
    case '!=': return actual !== expected;
    case '>': return actual > expected;
    case '>=': return actual >= expected;
    case '<': return actual < expected;
    case '<=': return actual <= expected;
    default: return false;
  }
}

function compareString(actual: string, operator: string, expected: string): boolean {
  switch (operator) {
    case '=': return actual.toUpperCase() === expected;
    case '!=': return actual.toUpperCase() !== expected;
    default: return false;
  }
}
