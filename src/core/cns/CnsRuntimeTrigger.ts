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
  gameTime?: number;
  screenWidth?: number;
  screenHeight?: number;
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
  const rangeMatch = expression.match(/^(.+?)\s*(=|!=)\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]$/);
  if (rangeMatch) {
    const actual = readNumberExpression(rangeMatch[1], context);
    if (actual === null) return false;
    const min = Math.min(Number(rangeMatch[3]), Number(rangeMatch[4]));
    const max = Math.max(Number(rangeMatch[3]), Number(rangeMatch[4]));
    const inside = actual >= min && actual <= max;
    return rangeMatch[2] === '=' ? inside : !inside;
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

  const numberComparison = splitTopLevelComparison(expression);
  if (numberComparison) {
    const actual = readNumberExpression(numberComparison.left, context);
    const expected = readNumberExpression(numberComparison.right, context);
    if (actual !== null && expected !== null) {
      return compareNumber(actual, numberComparison.operator, expected);
    }
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
    case 'hitshakeover': return () => true;
    case 'hitfall': return (context) => readOptionalBool(context.player, 'hitFall', false);
    case 'canrecover': return () => true;
    case 'inguarddist': return (context) => Math.abs((context.opponent?.x ?? context.player.x + 999) - context.player.x) < 80;
    case 'movecontact': return (context) => hasMoveContact(context.player);
    case 'movehit': return (context) => hasMoveContact(context.player);
    case 'moveguarded': return () => false;
    case 'win': return () => false;
    case 'lose': return () => false;
    case 'drawgame': return () => false;
    case 'roundsexisted': return () => true;
    case 'p2ctrl': return (context) => context.opponent?.ctrl ?? true;
    case 'root': return () => true;
    case 'parent': return () => true;
    case 'enemynear': return (context) => Boolean(context.opponent);
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
    case 'p2name': return (context) => readOptionalString(context.opponent, 'name', '');
    case 'p2authorname': return (context) => readOptionalString(context.opponent, 'authorName', '');
    case 'name': return (context) => readOptionalString(context.player, 'name', '');
    case 'authorname': return (context) => readOptionalString(context.player, 'authorName', '');
    default: return getRedirectStringSource(name);
  }
}

function readNumberExpression(rawExpression: string, context: CnsRuntimeTriggerContext): number | null {
  const expression = stripOuterParentheses(normalizeName(rawExpression));
  const numericLiteral = Number(expression);
  if (Number.isFinite(numericLiteral)) return numericLiteral;

  const additive = splitTopLevelArithmetic(expression, ['+', '-']);
  if (additive) {
    const left = readNumberExpression(additive.left, context);
    const right = readNumberExpression(additive.right, context);
    if (left === null || right === null) return null;
    return additive.operator === '+' ? left + right : left - right;
  }

  const multiplicative = splitTopLevelArithmetic(expression, ['*', '/', '%']);
  if (multiplicative) {
    const left = readNumberExpression(multiplicative.left, context);
    const right = readNumberExpression(multiplicative.right, context);
    if (left === null || right === null) return null;
    if (multiplicative.operator === '*') return left * right;
    if (multiplicative.operator === '/') return right === 0 ? null : left / right;
    return right === 0 ? null : left % right;
  }

  const absMatch = expression.match(/^abs\((.+)\)$/);
  if (absMatch) {
    const value = readNumberExpression(absMatch[1], context);
    return value === null ? null : Math.abs(value);
  }

  const floorMatch = expression.match(/^floor\((.+)\)$/);
  if (floorMatch) {
    const value = readNumberExpression(floorMatch[1], context);
    return value === null ? null : Math.floor(value);
  }

  const ceilMatch = expression.match(/^ceil\((.+)\)$/);
  if (ceilMatch) {
    const value = readNumberExpression(ceilMatch[1], context);
    return value === null ? null : Math.ceil(value);
  }

  const mathMatch = expression.match(/^(acos|asin|atan|cos|exp|ln|log|sin|tan)\((.+)\)$/);
  if (mathMatch) {
    const value = readNumberExpression(mathMatch[2], context);
    if (value === null) return null;
    switch (mathMatch[1]) {
      case 'acos': return Math.acos(value);
      case 'asin': return Math.asin(value);
      case 'atan': return Math.atan(value);
      case 'cos': return Math.cos(value);
      case 'exp': return Math.exp(value);
      case 'ln': return value > 0 ? Math.log(value) : null;
      case 'log': return value > 0 ? Math.log10(value) : null;
      case 'sin': return Math.sin(value);
      case 'tan': return Math.tan(value);
      default: return null;
    }
  }

  const conditionalMatch = expression.match(/^(cond|ifelse)\((.+)\)$/);
  if (conditionalMatch) {
    const args = splitTopLevelArguments(conditionalMatch[2]);
    if (args.length !== 3) return null;
    return readNumberExpression(evaluateBooleanExpression(args[0], context) ? args[1] : args[2], context);
  }

  const source = getNumberSource(expression);
  return source ? source(context) : null;
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

  const getHitVarMatch = name.match(/^gethitvar\(([^)]+)\)$/);
  if (getHitVarMatch) return (context) => readGetHitVar(context.player, getHitVarMatch[1]);

  const numProjIdMatch = name.match(/^numprojid\((\d+)\)$/);
  if (numProjIdMatch) return () => 0;

  switch (name) {
    case 'e': return () => Math.E;
    case 'pi': return () => Math.PI;
    case 'time': return (context) => context.player.stateTime;
    case 'gametime': return (context) => context.gameTime ?? readOptionalNumber(context.player, 'gameTime', 0);
    case 'tickspersecond': return () => 60;
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
    case 'powermax': return () => 3000;
    case 'life': return (context) => context.player.life;
    case 'lifemax': return () => 1000;
    case 'random': return () => 500;
    case 'facing': return (context) => context.player.facing;
    case 'posx':
    case 'pos x': return (context) => context.player.x;
    case 'posy':
    case 'pos y': return (context) => context.player.y;
    case 'screenposx':
    case 'screenpos x': return (context) => context.player.x;
    case 'screenposy':
    case 'screenpos y': return (context) => context.player.y;
    case 'velx':
    case 'vel x': return (context) => context.player.vx;
    case 'vely':
    case 'vel y': return (context) => context.player.vy;
    case 'hitvelx':
    case 'hitvel x': return (context) => readOptionalNumber(context.player, 'hitVelX', 0);
    case 'hitvely':
    case 'hitvel y': return (context) => readOptionalNumber(context.player, 'hitVelY', 0);
    case 'hitpausetime': return (context) => context.player.hitPause;
    case 'hitcount': return () => 0;
    case 'hitfall': return (context) => readOptionalBool(context.player, 'hitFall', false) ? 1 : 0;
    case 'movecontact': return (context) => hasMoveContact(context.player) ? 1 : 0;
    case 'movehit': return (context) => hasMoveContact(context.player) ? 1 : 0;
    case 'moveguarded': return () => 0;
    case 'numenemy': return (context) => (context.opponent ? 1 : 1);
    case 'numtarget': return () => 0;
    case 'numhelper': return () => 0;
    case 'numproj': return () => 0;
    case 'numexplod': return () => 0;
    case 'numpartner': return () => 0;
    case 'numcommand': return (context) => context.commands?.size ?? 0;
    case 'ishelper': return () => 0;
    case 'backedgedist': return (context) => context.player.x;
    case 'frontedgedist': return (context) => (context.screenWidth ?? 960) - context.player.x;
    case 'p2life': return (context) => context.opponent?.life ?? 1000;
    case 'p2stateno': return (context) => context.opponent?.stateNo ?? 0;
    case 'p2facing': return (context) => context.opponent?.facing ?? -context.player.facing;
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
    default: return getFunctionNumberSource(name) ?? getRedirectNumberSource(name);
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
  const projCancelTimeMatch = name.match(/^projcanceltime\((\d+)\)$/);
  if (projCancelTimeMatch) return () => -1;

  return null;
}

function getRedirectNumberSource(name: string): NumberSource | null {
  const redirectMatch = name.match(/^(enemynear|enemy|target|parent|root)\s*,\s*(.+)$/);
  if (!redirectMatch) return null;

  const redirect = redirectMatch[1];
  const redirectedExpression = redirectMatch[2];

  return (context) => {
    const redirectedPlayer = redirect === 'parent' || redirect === 'root'
      ? context.player
      : context.opponent ?? context.player;
    return readNumberExpression(redirectedExpression, { ...context, player: redirectedPlayer, opponent: context.player }) ?? 0;
  };
}

function getRedirectStringSource(name: string): StringSource | null {
  const redirectMatch = name.match(/^(enemynear|enemy|target|parent|root)\s*,\s*(.+)$/);
  if (!redirectMatch) return null;

  const redirect = redirectMatch[1];
  const redirectedExpression = redirectMatch[2];

  return (context) => {
    const redirectedPlayer = redirect === 'parent' || redirect === 'root'
      ? context.player
      : context.opponent ?? context.player;
    const source = getStringSource(redirectedExpression);
    return source ? source({ ...context, player: redirectedPlayer, opponent: context.player }) : '';
  };
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

function splitTopLevelArguments(expression: string): string[] {
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
    if (depth === 0 && char === ',') {
      parts.push(expression.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(expression.slice(start).trim());
  return parts.filter(Boolean);
}

function splitTopLevelComparison(
  expression: string,
): { left: string; operator: string; right: string } | null {
  for (const operator of ['!=', '>=', '<=', '=', '>', '<']) {
    const index = findTopLevelOperator(expression, operator, false);
    if (index < 0) continue;
    return {
      left: expression.slice(0, index).trim(),
      operator,
      right: expression.slice(index + operator.length).trim(),
    };
  }

  return null;
}

function splitTopLevelArithmetic(
  expression: string,
  operators: readonly string[],
): { left: string; operator: string; right: string } | null {
  for (let index = expression.length - 1; index >= 0; index -= 1) {
    const operator = expression[index];
    if (!operators.includes(operator)) continue;
    if (!isTopLevelOperatorAt(expression, operator, index)) continue;
    if ((operator === '+' || operator === '-') && isUnarySign(expression, index)) continue;
    return {
      left: expression.slice(0, index).trim(),
      operator,
      right: expression.slice(index + 1).trim(),
    };
  }

  return null;
}

function findTopLevelOperator(expression: string, operator: string, allowUnarySign: boolean): number {
  for (let index = 0; index <= expression.length - operator.length; index += 1) {
    if (expression.slice(index, index + operator.length) !== operator) continue;
    if (!isTopLevelOperatorAt(expression, operator, index)) continue;
    if (!allowUnarySign && (operator === '+' || operator === '-') && isUnarySign(expression, index)) continue;
    return index;
  }

  return -1;
}

function isTopLevelOperatorAt(expression: string, operator: string, operatorIndex: number): boolean {
  let depth = 0;
  let inQuote = false;

  for (let index = 0; index < operatorIndex; index += 1) {
    const char = expression[index];
    if (char === '"') inQuote = !inQuote;
    if (inQuote) continue;
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
  }

  if (depth !== 0 || inQuote) return false;

  for (let index = operatorIndex; index < operatorIndex + operator.length; index += 1) {
    const char = expression[index];
    if (char === '"' || char === '(' || char === ')' || char === '[' || char === ']') return false;
  }

  return true;
}

function isUnarySign(expression: string, index: number): boolean {
  const before = expression.slice(0, index).trimEnd();
  const previous = before.length > 0 ? before[before.length - 1] : undefined;
  return previous === undefined || previous === '(' || previous === '[' || previous === ',' ||
    previous === '+' || previous === '-' || previous === '*' || previous === '/' || previous === '%';
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

function hasMoveContact(player: PlayerState): boolean {
  return Boolean(player.activeHitDef) || player.hitDefUsed;
}

function readOptionalNumber(player: PlayerState | undefined, key: string, fallback: number): number {
  return (player as PlayerState & Record<string, number | undefined> | undefined)?.[key] ?? fallback;
}

function readOptionalBool(player: PlayerState | undefined, key: string, fallback: boolean): boolean {
  return (player as PlayerState & Record<string, boolean | undefined> | undefined)?.[key] ?? fallback;
}

function readOptionalString(player: PlayerState | undefined, key: string, fallback: string): string {
  return (player as PlayerState & Record<string, string | undefined> | undefined)?.[key] ?? fallback;
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

function readGetHitVar(player: PlayerState, name: string): number {
  const normalized = name.trim().toLowerCase();
  const vars = (player as PlayerState & { getHitVars?: Record<string, number> }).getHitVars;
  if (vars?.[normalized] !== undefined) return vars[normalized];

  switch (normalized) {
    case 'xvel': return readOptionalNumber(player, 'hitVelX', 0);
    case 'yvel': return readOptionalNumber(player, 'hitVelY', 0);
    case 'fall': return readOptionalBool(player, 'hitFall', false) ? 1 : 0;
    case 'damage': return 0;
    case 'hitcount': return 0;
    case 'hittime': return 0;
    case 'slidetime': return 0;
    case 'ctrltime': return 0;
    default: return 0;
  }
}

function readDefaultConst(name: string): number {
  switch (name.trim().toLowerCase()) {
    case 'data.life': return 1000;
    case 'data.power': return 3000;
    case 'size.xscale': return 1;
    case 'size.yscale': return 1;
    case 'size.ground.back': return 15;
    case 'size.ground.front': return 16;
    case 'size.air.back': return 12;
    case 'size.air.front': return 12;
    case 'size.height': return 60;
    case 'size.attack.dist': return 160;
    case 'velocity.walk.fwd.x': return 2;
    case 'velocity.walk.back.x': return -2;
    case 'velocity.jump.y': return -8.4;
    case 'velocity.jump.neu.x': return 0;
    case 'velocity.jump.fwd.x': return 3.2;
    case 'velocity.jump.back.x': return -3.2;
    case 'movement.airjump.num': return 1;
    case 'movement.airjump.height': return 35;
    case 'movement.yaccel': return 0.6;
    default: return 0;
  }
}

function stateTypeToNumber(stateType: PlayerState['stateType']): number {
  return stateType === 'S' ? 0 : stateType === 'C' ? 1 : stateType === 'A' ? 2 : 3;
}

function moveTypeToNumber(moveType: PlayerState['moveType']): number {
  return moveType === 'I' ? 0 : moveType === 'A' ? 1 : 2;
}
