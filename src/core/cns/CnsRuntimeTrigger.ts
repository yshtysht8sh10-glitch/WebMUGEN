import type { PlayerState } from '../engine/types';

export type CnsRuntimeTriggerContext = {
  player: PlayerState;
  opponent?: PlayerState;
  commands?: ReadonlySet<string>;
  animTime?: number;
  roundState?: number;
  roundNo?: number;
  aiLevel?: number;
  teamSide?: number;
};

type NumberSource = (context: CnsRuntimeTriggerContext) => number;
type StringSource = (context: CnsRuntimeTriggerContext) => string;
type BooleanSource = (context: CnsRuntimeTriggerContext) => boolean;

export function evaluateCnsRuntimeTrigger(
  expression: string,
  context: CnsRuntimeTriggerContext,
): boolean {
  return evaluateBooleanExpression(normalizeExpression(expression), context);
}

function evaluateBooleanExpression(expression: string, context: CnsRuntimeTriggerContext): boolean {
  const trimmed = stripOuterParentheses(expression.trim());
  if (!trimmed) return false;

  const orParts = splitTopLevel(trimmed, '||');
  if (orParts.length > 1) return orParts.some((part) => evaluateBooleanExpression(part, context));

  const andParts = splitTopLevel(trimmed, '&&');
  if (andParts.length > 1) return andParts.every((part) => evaluateBooleanExpression(part, context));

  if (trimmed.startsWith('!')) return !evaluateBooleanExpression(trimmed.slice(1), context);

  if (trimmed === '1') return true;
  if (trimmed === '0') return false;

  const bareBoolean = getBooleanSource(trimmed);
  if (bareBoolean) return bareBoolean(context);

  return evaluateComparison(trimmed, context);
}

function evaluateComparison(expression: string, context: CnsRuntimeTriggerContext): boolean {
  const rangeMatch = expression.match(/^(.+?)\s*=\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]$/);
  if (rangeMatch) {
    const source = getNumberSource(rangeMatch[1]);
    if (!source) return false;
    const actual = source(context);
    const min = Number(rangeMatch[2]);
    const max = Number(rangeMatch[3]);
    return actual >= Math.min(min, max) && actual <= Math.max(min, max);
  }

  const stringMatch = expression.match(/^(.+?)\s*(=|!=)\s*"([^"]*)"$/);
  if (stringMatch) {
    if (stringMatch[1].trim() === 'command') {
      const active = context.commands?.has(stringMatch[3].toLowerCase()) ?? false;
      return stringMatch[2] === '=' ? active : !active;
    }

    const source = getStringSource(stringMatch[1]);
    if (!source) return false;
    return compareString(source(context), stringMatch[2], stringMatch[3]);
  }

  const numberMatch = expression.match(/^(.+?)\s*(=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (numberMatch) {
    const source = getNumberSource(numberMatch[1]);
    if (!source) return false;
    return compareNumber(source(context), numberMatch[2], Number(numberMatch[3]));
  }

  const enumMatch = expression.match(/^(.+?)\s*(=|!=)\s*([a-z]+)$/i);
  if (enumMatch) {
    const source = getStringSource(enumMatch[1]);
    if (!source) return false;
    return compareString(source(context), enumMatch[2], enumMatch[3]);
  }

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

  if (!triggerAll.every((expression) => evaluateCnsRuntimeTrigger(expression, context))) return false;
  if (groups.size === 0) return triggerAll.length > 0;

  return Array.from(groups.values()).some((group) =>
    group.every((expression) => evaluateCnsRuntimeTrigger(expression, context)),
  );
}

function getBooleanSource(name: string): BooleanSource | null {
  switch (normalizeName(name)) {
    case 'ctrl': return (context) => context.player.ctrl;
    case 'alive': return (context) => context.player.life > 0;
    case 'hitover': return () => true;
    case 'movecontact': return (context) => Boolean(context.player.activeHitDef) || context.player.hitDefUsed;
    case 'movehit': return (context) => Boolean(context.player.activeHitDef) || context.player.hitDefUsed;
    case 'moveguarded': return () => false;
    case 'win': return () => false;
    case 'lose': return () => false;
    case 'drawgame': return () => false;
    case 'roundsexisted': return () => true;
    default: return null;
  }
}

function getStringSource(rawName: string): StringSource | null {
  const name = normalizeName(rawName);
  switch (name) {
    case 'statetype': return (context) => context.player.stateType;
    case 'movetype': return (context) => context.player.moveType;
    case 'physics': return (context) => context.player.physics;
    case 'p2statetype': return (context) => context.opponent?.stateType ?? 'S';
    case 'p2movetype': return (context) => context.opponent?.moveType ?? 'I';
    case 'name': return () => '';
    case 'authorname': return () => '';
    default: return null;
  }
}

function getNumberSource(rawName: string): NumberSource | null {
  const name = normalizeName(rawName);

  const varMatch = name.match(/^var\((\d+)\)$/);
  if (varMatch) return (context) => readPlayerVar(context.player, Number(varMatch[1]));

  const sysVarMatch = name.match(/^sysvar\((\d+)\)$/);
  if (sysVarMatch) return (context) => readPlayerSysVar(context.player, Number(sysVarMatch[1]));

  const fVarMatch = name.match(/^fvar\((\d+)\)$/);
  if (fVarMatch) return (context) => readPlayerFVar(context.player, Number(fVarMatch[1]));

  const constMatch = name.match(/^const\(([^)]+)\)$/);
  if (constMatch) return () => readDefaultConst(constMatch[1]);

  switch (name) {
    case 'time': return (context) => context.player.stateTime;
    case 'animtime': return (context) => context.animTime ?? context.player.animTime;
    case 'anim': return (context) => context.player.animNo;
    case 'animelem': return (context) => context.player.animTime;
    case 'stateno': return (context) => context.player.stateNo;
    case 'prevstateno': return (context) => readOptionalNumber(context.player, 'prevStateNo', context.player.stateNo);
    case 'roundstate': return (context) => context.roundState ?? 2;
    case 'roundno': return (context) => context.roundNo ?? 1;
    case 'ailevel': return (context) => context.aiLevel ?? 0;
    case 'teamside': return (context) => context.teamSide ?? context.player.id;
    case 'power': return (context) => readOptionalNumber(context.player, 'power', 0);
    case 'life': return (context) => context.player.life;
    case 'lifemax': return () => 1000;
    case 'random': return () => 500;
    case 'facing': return (context) => context.player.facing;
    case 'posx':
    case 'pos x': return (context) => context.player.x;
    case 'posy':
    case 'pos y': return (context) => context.player.y;
    case 'velx':
    case 'vel x': return (context) => context.player.vx;
    case 'vely':
    case 'vel y': return (context) => context.player.vy;
    case 'hitpausetime': return (context) => context.player.hitPause;
    case 'hitcount': return () => 0;
    case 'movecontact': return (context) => (Boolean(context.player.activeHitDef) || context.player.hitDefUsed ? 1 : 0);
    case 'movehit': return (context) => (Boolean(context.player.activeHitDef) || context.player.hitDefUsed ? 1 : 0);
    case 'moveguarded': return () => 0;
    case 'numenemy': return (context) => (context.opponent ? 1 : 1);
    case 'numtarget': return () => 0;
    case 'numhelper': return () => 0;
    case 'numproj': return () => 0;
    case 'numexplod': return () => 0;
    case 'numpartner': return () => 0;
    case 'ishelper': return () => 0;
    case 'p2life': return (context) => context.opponent?.life ?? 1000;
    case 'p2bodydistx':
    case 'p2bodydist x':
    case 'p2distx':
    case 'p2dist x': return (context) => (context.opponent ? Math.abs(context.opponent.x - context.player.x) : 999);
    case 'p2bodydisty':
    case 'p2bodydist y':
    case 'p2disty':
    case 'p2dist y': return (context) => (context.opponent ? context.opponent.y - context.player.y : 0);
    case 'p2statetype': return (context) => stateTypeToNumber(context.opponent?.stateType ?? 'S');
    case 'p2movetype': return (context) => moveTypeToNumber(context.opponent?.moveType ?? 'I');
    default: return getFunctionNumberSource(name);
  }
}

function getFunctionNumberSource(name: string): NumberSource | null {
  const animelemTimeMatch = name.match(/^animelemtime\((\d+)\)$/);
  if (animelemTimeMatch) {
    const elemNo = Number(animelemTimeMatch[1]);
    return (context) => context.player.animTime - elemNo;
  }

  const projContactTimeMatch = name.match(/^projcontacttime\((\d+)\)$/);
  if (projContactTimeMatch) return () => -1;

  const projHitTimeMatch = name.match(/^projhittime\((\d+)\)$/);
  if (projHitTimeMatch) return () => -1;

  const projGuardedTimeMatch = name.match(/^projguardedtime\((\d+)\)$/);
  if (projGuardedTimeMatch) return () => -1;

  return null;
}

function normalizeExpression(expression: string): string {
  return expression.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function splitTopLevel(expression: string, operator: '&&' | '||'): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote = false;
  let start = 0;

  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (char === '"') inQuote = !inQuote;
    if (inQuote) continue;
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
    if (depth === 0 && expression.slice(index, index + operator.length) === operator) {
      parts.push(expression.slice(start, index).trim());
      start = index + operator.length;
      index += operator.length - 1;
    }
  }

  parts.push(expression.slice(start).trim());
  return parts.filter(Boolean);
}

function stripOuterParentheses(expression: string): string {
  let result = expression;
  while (result.startsWith('(') && result.endsWith(')') && wrapsWholeExpression(result)) {
    result = result.slice(1, -1).trim();
  }
  return result;
}

function wrapsWholeExpression(expression: string): boolean {
  let depth = 0;
  let inQuote = false;
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (char === '"') inQuote = !inQuote;
    if (inQuote) continue;
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && index < expression.length - 1) return false;
  }
  return depth === 0;
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
    case '=': return actual.toUpperCase() === expected.toUpperCase();
    case '!=': return actual.toUpperCase() !== expected.toUpperCase();
    default: return false;
  }
}

function readOptionalNumber(player: PlayerState, key: string, fallback: number): number {
  return (player as PlayerState & Record<string, number | undefined>)[key] ?? fallback;
}

function readPlayerVar(player: PlayerState, index: number): number {
  return (player as PlayerState & { vars?: Record<number, number> }).vars?.[index] ?? 0;
}

function readPlayerSysVar(player: PlayerState, index: number): number {
  return (player as PlayerState & { sysVars?: Record<number, number> }).sysVars?.[index] ?? 0;
}

function readPlayerFVar(player: PlayerState, index: number): number {
  return (player as PlayerState & { fvars?: Record<number, number> }).fvars?.[index] ?? 0;
}

function readDefaultConst(name: string): number {
  switch (name.trim().toLowerCase()) {
    case 'data.life': return 1000;
    case 'data.power': return 3000;
    case 'velocity.walk.fwd.x': return 2;
    case 'velocity.walk.back.x': return -2;
    case 'velocity.jump.y': return -8.4;
    case 'velocity.jump.neu.x': return 0;
    case 'velocity.jump.fwd.x': return 3.2;
    case 'velocity.jump.back.x': return -3.2;
    case 'movement.airjump.num': return 1;
    default: return 0;
  }
}

function stateTypeToNumber(stateType: PlayerState['stateType']): number {
  return stateType === 'S' ? 0 : stateType === 'C' ? 1 : stateType === 'A' ? 2 : 3;
}

function moveTypeToNumber(moveType: PlayerState['moveType']): number {
  return moveType === 'I' ? 0 : moveType === 'A' ? 1 : 2;
}
