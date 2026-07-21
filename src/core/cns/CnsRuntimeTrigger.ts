import type { PlayerState } from '../engine/types';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';
import { selectTargets } from '../hitdef/TargetState';
import { hitDefAttrMatches } from '../hitdef/HitAttribute';
import type { CnsDocument, CnsTrigger } from '../../mugen/common/cnsTypes';
import { readCnsConst } from './CnsConstants';
import { readPlayerPowerMax } from '../power/PowerGauge';
import { buildPushBox, FALLBACK_STAGE_LEFT, FALLBACK_STAGE_RIGHT } from '../engine/FallbackStageRules';

export type CnsRuntimeTriggerContext = {
  player: PlayerState;
  opponent?: PlayerState;
  commands?: ReadonlySet<string>;
  animTime?: number;
  animElemNo?: number;
  animElemTime?: number;
  animElemStarted?: boolean;
  animElemCount?: number;
  animElemTimes?: readonly number[];
  roundState?: number;
  roundNo?: number;
  matchOver?: boolean;
  roundWinner?: 1 | 2 | 'draw' | null;
  aiLevel?: number;
  teamSide?: number;
  gameTime?: number;
  screenWidth?: number;
  screenHeight?: number;
  animationExists?: (animNo: number) => boolean;
  constants?: CnsDocument;
  isHelper?: boolean;
  numHelper?: (helperId?: number) => number;
  getRedirectAnimationContext?: (player: PlayerState) => Pick<
    CnsRuntimeTriggerContext,
    'animTime' | 'animElemNo' | 'animElemTime' | 'animElemStarted' | 'animElemCount' | 'animElemTimes'
  >;
};

type NumberSource = (context: CnsRuntimeTriggerContext) => number | null;
type StringSource = (context: CnsRuntimeTriggerContext) => string | null;
type BooleanSource = (context: CnsRuntimeTriggerContext) => boolean;

export type CompiledCnsRuntimeTrigger = {
  expression: string;
  evaluate: BooleanSource;
};

const compiledTriggerCache = new Map<string, CompiledCnsRuntimeTrigger>();
const compiledTriggerRecords = new WeakMap<CnsTrigger, CompiledCnsRuntimeTrigger>();

export function evaluateCnsRuntimeTrigger(
  expression: string,
  context: CnsRuntimeTriggerContext,
): boolean {
  return compileCnsRuntimeTrigger(expression).evaluate(context);
}

export function evaluateCnsRuntimeTriggerLegacy(
  expression: string,
  context: CnsRuntimeTriggerContext,
): boolean {
  return evaluateBooleanExpression(normalizeExpression(expression), context);
}

export function compileCnsRuntimeTrigger(expression: string): CompiledCnsRuntimeTrigger {
  const cached = compiledTriggerCache.get(expression);
  if (cached) return cached;
  const compiled = {
    expression,
    evaluate: compileBooleanExpression(normalizeExpression(expression)),
  };
  compiledTriggerCache.set(expression, compiled);
  return compiled;
}

export function prepareCnsRuntimeTrigger(trigger: CnsTrigger): CompiledCnsRuntimeTrigger {
  const cached = compiledTriggerRecords.get(trigger);
  if (cached?.expression === trigger.expression) return cached;
  const compiled = compileCnsRuntimeTrigger(trigger.expression);
  compiledTriggerRecords.set(trigger, compiled);
  return compiled;
}

export function prepareCnsDocumentRuntimeTriggers(document: CnsDocument): void {
  for (const state of document.states) {
    for (const controller of state.controllers) {
      for (const trigger of controller.triggers) prepareCnsRuntimeTrigger(trigger);
    }
  }
}

export function evaluatePreparedCnsRuntimeTrigger(
  trigger: CnsTrigger,
  context: CnsRuntimeTriggerContext,
): boolean {
  return prepareCnsRuntimeTrigger(trigger).evaluate(context);
}

function compileBooleanExpression(expression: string): BooleanSource {
  const trimmed = stripOuterParentheses(expression.trim());
  if (!trimmed) return () => false;

  const orParts = splitTopLevel(trimmed, '||');
  if (orParts.length > 1) {
    const sources = orParts.map(compileBooleanExpression);
    return (context) => sources.some((source) => source(context));
  }

  const andParts = splitTopLevel(trimmed, '&&');
  if (andParts.length > 1) {
    const sources = andParts.map(compileBooleanExpression);
    return (context) => sources.every((source) => source(context));
  }

  if (trimmed.startsWith('!')) {
    const source = compileBooleanExpression(trimmed.slice(1));
    return (context) => !source(context);
  }
  if (trimmed === '1') return () => true;
  if (trimmed === '0') return () => false;

  const bareBoolean = getBooleanSource(trimmed);
  if (bareBoolean) return bareBoolean;

  if (!splitTopLevelComparison(trimmed)) {
    const numeric = compileNumberExpression(trimmed);
    if (numeric) return (context) => {
      const value = numeric(context);
      return value !== null && value !== 0;
    };
  }

  return compileComparison(trimmed);
}

function compileComparison(expression: string): BooleanSource {
  const animElemMatch = expression.match(/^animelem\s*=\s*(-?\d+)(?:\s*,\s*(=|!=|>=|<=|>|<)?\s*(-?\d+))?$/i);
  if (animElemMatch) {
    const elementNo = Number(animElemMatch[1]);
    const operator = animElemMatch[2] ?? '=';
    const expected = animElemMatch[3] === undefined ? undefined : Number(animElemMatch[3]);
    return (context) => {
      if (!Number.isInteger(elementNo) || elementNo < 1 || (context.animElemCount !== undefined && elementNo > context.animElemCount)) return false;
      if (expected === undefined) return context.animElemNo === elementNo && context.animElemStarted === true;
      const elementTime = context.animElemTimes?.[elementNo - 1];
      return elementTime !== undefined && compareNumber(elementTime, operator, expected);
    };
  }

  const timeModMatch = expression.match(/^timemod\s*(=|!=|>=|<=|>|<)\s*(-?\d+)\s*,\s*(-?\d+)$/i);
  if (timeModMatch) {
    const divisor = Number(timeModMatch[2]);
    const expected = Number(timeModMatch[3]);
    const operator = timeModMatch[1];
    return divisor <= 0 ? () => false : (context) => compareNumber(context.player.stateTime % divisor, operator, expected);
  }

  const hitDefAttrMatch = expression.match(/^hitdefattr\s*(=|!=)\s*([^,]+)\s*,\s*(.+)$/i);
  if (hitDefAttrMatch) {
    const operator = hitDefAttrMatch[1];
    const stateTypes = hitDefAttrMatch[2];
    const attackTypes = hitDefAttrMatch[3].split(',');
    return (context) => {
      const matches = hitDefAttrMatches(context.player.activeHitDef?.attr, stateTypes, attackTypes);
      return operator === '=' ? matches : !matches;
    };
  }

  const rangeMatch = expression.match(/^(.+?)\s*(=|!=)\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]$/);
  if (rangeMatch) {
    const actual = compileNumberExpression(rangeMatch[1]);
    if (!actual) return () => false;
    const min = Math.min(Number(rangeMatch[3]), Number(rangeMatch[4]));
    const max = Math.max(Number(rangeMatch[3]), Number(rangeMatch[4]));
    const equals = rangeMatch[2] === '=';
    return (context) => {
      const value = actual(context);
      if (value === null) return false;
      const inside = value >= min && value <= max;
      return equals ? inside : !inside;
    };
  }

  const stringMatch = expression.match(/^(.+?)\s*(=|!=)\s*"([^"]*)"$/);
  if (stringMatch) {
    const name = stringMatch[1].trim();
    const operator = stringMatch[2];
    const expected = stringMatch[3];
    if (name === 'command') {
      return (context) => {
        const active = context.commands?.has(expected.toLowerCase()) ?? false;
        return operator === '=' ? active : !active;
      };
    }
    const source = getStringSource(name);
    if (!source) return () => false;
    return (context) => {
      const actual = source(context);
      return actual !== null && compareString(actual, operator, expected);
    };
  }

  const numberComparison = splitTopLevelComparison(expression);
  if (numberComparison) {
    const actual = compileNumberExpression(numberComparison.left);
    const expected = compileNumberExpression(numberComparison.right);
    if (actual && expected) return (context) => {
      const left = actual(context);
      const right = expected(context);
      return left !== null && right !== null && compareNumber(left, numberComparison.operator, right);
    };
  }

  const enumMatch = expression.match(/^(.+?)\s*(=|!=)\s*([a-z]+)$/i);
  if (enumMatch) {
    const source = getStringSource(enumMatch[1]);
    if (!source) return () => false;
    return (context) => {
      const actual = source(context);
      return actual !== null && compareString(actual, enumMatch[2], enumMatch[3]);
    };
  }

  return () => false;
}

function compileNumberExpression(rawExpression: string): NumberSource | null {
  const expression = stripOuterParentheses(normalizeName(rawExpression));
  const numericLiteral = Number(expression);
  if (Number.isFinite(numericLiteral)) return () => numericLiteral;

  const additive = splitTopLevelArithmetic(expression, ['+', '-']);
  if (additive) {
    const left = compileNumberExpression(additive.left);
    const right = compileNumberExpression(additive.right);
    if (!left || !right) return null;
    return (context) => {
      const leftValue = left(context);
      const rightValue = right(context);
      if (leftValue === null || rightValue === null) return null;
      return additive.operator === '+' ? leftValue + rightValue : leftValue - rightValue;
    };
  }

  const multiplicative = splitTopLevelArithmetic(expression, ['*', '/', '%']);
  if (multiplicative) {
    const left = compileNumberExpression(multiplicative.left);
    const right = compileNumberExpression(multiplicative.right);
    if (!left || !right) return null;
    return (context) => {
      const leftValue = left(context);
      const rightValue = right(context);
      if (leftValue === null || rightValue === null) return null;
      if (multiplicative.operator === '*') return leftValue * rightValue;
      if (multiplicative.operator === '/') return rightValue === 0 ? null : leftValue / rightValue;
      return rightValue === 0 ? null : leftValue % rightValue;
    };
  }

  const unaryFunctions: Record<string, (value: number) => number | null> = {
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    acos: Math.acos,
    asin: Math.asin,
    atan: Math.atan,
    cos: Math.cos,
    exp: Math.exp,
    ln: (value) => value > 0 ? Math.log(value) : null,
    log: (value) => value > 0 ? Math.log10(value) : null,
    sin: Math.sin,
    tan: Math.tan,
  };
  const functionMatch = expression.match(/^(abs|floor|ceil|acos|asin|atan|cos|exp|ln|log|sin|tan)\((.+)\)$/);
  if (functionMatch) {
    const argument = compileNumberExpression(functionMatch[2]);
    const operation = unaryFunctions[functionMatch[1]];
    if (!argument) return null;
    return (context) => {
      const value = argument(context);
      return value === null ? null : operation(value);
    };
  }

  const conditionalMatch = expression.match(/^(cond|ifelse)\((.+)\)$/);
  if (conditionalMatch) {
    const args = splitTopLevelArguments(conditionalMatch[2]);
    if (args.length !== 3) return null;
    const condition = compileBooleanExpression(args[0]);
    const whenTrue = compileNumberExpression(args[1]) ?? (() => null);
    const whenFalse = compileNumberExpression(args[2]) ?? (() => null);
    return (context) => (condition(context) ? whenTrue(context) : whenFalse(context));
  }

  if (splitTopLevelComparison(expression) || splitTopLevel(expression, '&&').length > 1 || splitTopLevel(expression, '||').length > 1 || expression.startsWith('!')) {
    const boolean = compileBooleanExpression(expression);
    return (context) => boolean(context) ? 1 : 0;
  }

  return getNumberSource(expression);
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

  if (!splitTopLevelComparison(trimmed)) {
    const numeric = readNumberExpression(trimmed, context);
    if (numeric !== null) return numeric !== 0;
  }

  return evaluateComparison(trimmed, context);
}

function evaluateComparison(expression: string, context: CnsRuntimeTriggerContext): boolean {
  const animElemMatch = expression.match(/^animelem\s*=\s*(-?\d+)(?:\s*,\s*(=|!=|>=|<=|>|<)?\s*(-?\d+))?$/i);
  if (animElemMatch) {
    const elementNo = Number(animElemMatch[1]);
    if (!Number.isInteger(elementNo) || elementNo < 1 || (context.animElemCount !== undefined && elementNo > context.animElemCount)) {
      return false;
    }

    if (animElemMatch[3] === undefined) {
      return context.animElemNo === elementNo && context.animElemStarted === true;
    }

    const elementTime = context.animElemTimes?.[elementNo - 1];
    if (elementTime === undefined) return false;
    return compareNumber(elementTime, animElemMatch[2] ?? '=', Number(animElemMatch[3]));
  }

  const timeModMatch = expression.match(/^timemod\s*(=|!=|>=|<=|>|<)\s*(-?\d+)\s*,\s*(-?\d+)$/i);
  if (timeModMatch) {
    const divisor = Number(timeModMatch[2]);
    if (divisor <= 0) return false;
    return compareNumber(context.player.stateTime % divisor, timeModMatch[1], Number(timeModMatch[3]));
  }
  const hitDefAttrMatch = expression.match(/^hitdefattr\s*(=|!=)\s*([^,]+)\s*,\s*(.+)$/i);
  if (hitDefAttrMatch) {
    const attackTypes = hitDefAttrMatch[3].split(',');
    const matches = hitDefAttrMatches(context.player.activeHitDef?.attr, hitDefAttrMatch[2], attackTypes);
    return hitDefAttrMatch[1] === '=' ? matches : !matches;
  }

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
    const actual = source(context);
    return actual !== null && compareString(actual, stringMatch[2], stringMatch[3]);
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
    const actual = source(context);
    return actual !== null && compareString(actual, enumMatch[2], enumMatch[3]);
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
    case 'hitover': return (context) => !context.player.hitStun || context.player.hitStun.elapsed >= context.player.hitStun.selectedHitTime;
    case 'hitshakeover': return (context) => context.player.hitPause <= 0;
    case 'hitfall': return (context) => readOptionalBool(context.player, 'hitFall', false);
    case 'canrecover': return (context) => context.player.fallRecover !== false
      && (context.player.hitStun?.elapsed ?? context.player.hitReactionElapsed ?? context.player.stateTime) >= (context.player.fallRecoverTime ?? 0);
    case 'inguarddist': return (context) => Math.abs((context.opponent?.x ?? context.player.x + 999) - context.player.x) < 80;
    case 'movecontact': return (context) => context.player.moveContact?.contact === true;
    case 'movehit': return (context) => context.player.moveContact?.hit === true;
    case 'moveguarded': return (context) => context.player.moveContact?.guarded === true;
    case 'matchover': return (context) => context.matchOver === true;
    case 'win': return (context) => context.roundWinner === context.player.id;
    case 'lose': return (context) => context.roundWinner !== null && context.roundWinner !== undefined && context.roundWinner !== 'draw' && context.roundWinner !== context.player.id;
    case 'drawgame': return (context) => context.roundWinner === 'draw';
    case 'roundsexisted': return () => true;
    case 'p2ctrl': return (context) => context.opponent?.ctrl ?? true;
    case 'root': return () => true;
    case 'parent': return () => true;
    case 'enemynear': return (context) => Boolean(context.opponent);
    default: return getRedirectBooleanSource(name);
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

export function readNumberExpression(rawExpression: string, context: CnsRuntimeTriggerContext): number | null {
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

  if (splitTopLevelComparison(expression) || splitTopLevel(expression, '&&').length > 1 || splitTopLevel(expression, '||').length > 1 || expression.startsWith('!')) {
    return evaluateBooleanExpression(expression, context) ? 1 : 0;
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
  if (constMatch) return (context) => readCnsConst(context.constants, constMatch[1]);

  const getHitVarMatch = name.match(/^gethitvar\(([^)]+)\)$/);
  if (getHitVarMatch) return (context) => readGetHitVar(context.player, getHitVarMatch[1]);

  const numProjIdMatch = name.match(/^numprojid\((\d+)\)$/);
  if (numProjIdMatch) return () => 0;

  const numHelperMatch = name.match(/^numhelper(?:\((.+)\))?$/);
  if (numHelperMatch) {
    const helperIdSource = numHelperMatch[1] === undefined ? null : compileNumberExpression(numHelperMatch[1]);
    return (context) => {
      const helperId = numHelperMatch[1] === undefined
        ? undefined
        : helperIdSource?.(context) ?? undefined;
      return context.numHelper?.(helperId) ?? 0;
    };
  }

  const targetMatch = name.match(/^(numtarget|targetid|targetstateno)(?:\((.+)\))?$/);
  if (targetMatch) {
    const requestedIdSource = targetMatch[2] === undefined ? null : compileNumberExpression(targetMatch[2]);
    return (context) => {
      const requestedId = targetMatch[2] === undefined ? undefined : requestedIdSource?.(context) ?? undefined;
      const targets = selectTargets(context.player, requestedId);
      if (targetMatch[1] === 'numtarget') return targets.length;
      const selected = targets[0];
      if (!selected) return targetMatch[1] === 'targetid' ? -1 : 0;
      if (targetMatch[1] === 'targetid') return selected.playerId;
      return context.opponent?.id === selected.playerId ? context.opponent.stateNo : 0;
    };
  }

  const animExistMatch = name.match(/^animexist\(([^)]+)\)$/);
  if (animExistMatch) {
    const animNoSource = compileNumberExpression(animExistMatch[1]);
    return (context) => {
      const animNo = animNoSource?.(context) ?? null;
      return animNo !== null && context.animationExists?.(animNo) ? 1 : 0;
    };
  }

  const selfAnimExistMatch = name.match(/^selfanimexist\(([^)]+)\)$/);
  if (selfAnimExistMatch) {
    const animNoSource = compileNumberExpression(selfAnimExistMatch[1]);
    return (context) => {
      const animNo = animNoSource?.(context) ?? null;
      return animNo !== null && context.animationExists?.(animNo) ? 1 : 0;
    };
  }

  switch (name) {
    case 'e': return () => Math.E;
    case 'pi': return () => Math.PI;
    case 'time':
    case 'statetime': return (context) => context.player.stateTime;
    case 'gametime': return (context) => context.gameTime ?? readOptionalNumber(context.player, 'gameTime', 0);
    case 'tickspersecond': return () => 60;
    case 'animtime': return (context) => context.animTime ?? context.player.animTime;
    case 'anim': return (context) => context.player.animNo;
    case 'animelemno': return (context) => context.animElemNo ?? 1;
    case 'animelem': return (context) => context.animElemNo ?? null;
    case 'ctrl': return (context) => context.player.ctrl ? 1 : 0;
    case 'alive': return (context) => context.player.life > 0 ? 1 : 0;
    case 'matchover': return (context) => context.matchOver ? 1 : 0;
    case 'win': return (context) => context.roundWinner === context.player.id ? 1 : 0;
    case 'lose': return (context) => context.roundWinner !== null && context.roundWinner !== undefined && context.roundWinner !== 'draw' && context.roundWinner !== context.player.id ? 1 : 0;
    case 'drawgame': return (context) => context.roundWinner === 'draw' ? 1 : 0;
    case 'stateno': return (context) => context.player.stateNo;
    case 'prevstateno': return (context) => readOptionalNumber(context.player, 'prevStateNo', context.player.stateNo);
    case 'roundstate': return (context) => context.roundState ?? 2;
    case 'roundno': return (context) => context.roundNo ?? 1;
    case 'ailevel': return (context) => context.aiLevel ?? 0;
    case 'teamside': return (context) => context.teamSide ?? context.player.id;
    case 'power': return (context) => readOptionalNumber(context.player, 'power', 0);
    case 'powermax': return (context) => readPlayerPowerMax(context.player);
    case 'life': return (context) => context.player.life;
    case 'lifemax': return () => 1000;
    case 'random': return () => 500;
    case 'facing': return (context) => context.player.facing;
    case 'posx':
    case 'pos x': return (context) => context.player.x;
    case 'posy':
    case 'pos y': return (context) => internalYToMugenY(context.player.y);
    case 'screenposx':
    case 'screenpos x': return (context) => context.player.x;
    case 'screenposy':
    case 'screenpos y': return (context) => context.player.y;
    case 'velx':
    case 'vel x': return (context) => context.player.vx * context.player.facing;
    case 'vely':
    case 'vel y': return (context) => context.player.vy;
    case 'hitvelx':
    case 'hitvel x': return (context) => readOptionalNumber(context.player, 'hitVelX', 0);
    case 'hitvely':
    case 'hitvel y': return (context) => readOptionalNumber(context.player, 'hitVelY', 0);
    case 'hitpausetime': return (context) => context.player.hitPause;
    case 'hitcount': return (context) => context.player.moveContact?.hitCount ?? 0;
    case 'hitfall': return (context) => readOptionalBool(context.player, 'hitFall', false) ? 1 : 0;
    case 'movecontact': return (context) => context.player.moveContact?.contact ? context.player.moveContact.elapsed ?? 1 : 0;
    case 'movehit': return (context) => context.player.moveContact?.hit ? context.player.moveContact.elapsed ?? 1 : 0;
    case 'moveguarded': return (context) => context.player.moveContact?.guarded ? context.player.moveContact.elapsed ?? 1 : 0;
    case 'numenemy': return (context) => (context.opponent ? 1 : 1);
    case 'numproj': return () => 0;
    case 'numexplod': return () => 0;
    case 'numpartner': return () => 0;
    case 'numcommand': return (context) => context.commands?.size ?? 0;
    case 'ishelper': return (context) => context.isHelper ? 1 : 0;
    case 'backedgedist': return (context) => context.player.x;
    case 'frontedgedist': return (context) => (context.screenWidth ?? 960) - context.player.x;
    case 'backedgebodydist': return (context) => context.player.facing === 1
      ? context.player.x - FALLBACK_STAGE_LEFT
      : FALLBACK_STAGE_RIGHT - context.player.x;
    case 'frontedgebodydist': return (context) => context.player.facing === 1
      ? FALLBACK_STAGE_RIGHT - context.player.x
      : context.player.x - FALLBACK_STAGE_LEFT;
    case 'p2life': return (context) => context.opponent?.life ?? 1000;
    case 'p2stateno': return (context) => context.opponent?.stateNo ?? 0;
    case 'p2facing': return (context) => context.opponent?.facing ?? -context.player.facing;
    case 'p2bodydistx':
    case 'p2bodydist x': return (context) => readP2BodyDistX(context.player, context.opponent);
    case 'p2distx':
    case 'p2dist x': return (context) => (context.opponent ? Math.abs(context.opponent.x - context.player.x) : 999);
    case 'bodydistx':
    case 'bodydist x': return (context) => readP2BodyDistX(context.player, context.opponent);
    case 'p2bodydisty':
    case 'p2bodydist y':
    case 'p2disty':
    case 'p2dist y': return (context) => (context.opponent ? context.opponent.y - context.player.y : 0);
    case 'bodydisty':
    case 'bodydist y': return (context) => (context.opponent ? context.opponent.y - context.player.y : 0);
    case 'p2statetype': return (context) => stateTypeToNumber(context.opponent?.stateType ?? 'S');
    case 'p2movetype': return (context) => moveTypeToNumber(context.opponent?.moveType ?? 'I');
    default: return getFunctionNumberSource(name) ?? getRedirectNumberSource(name);
  }
}

function readP2BodyDistX(player: PlayerState, opponent: PlayerState | undefined): number {
  if (!opponent) return 999;
  const playerBox = buildPushBox(player);
  const opponentBox = buildPushBox(opponent);
  const playerFront = player.facing === 1 ? playerBox.right : playerBox.left;
  const opponentFront = opponent.facing === 1 ? opponentBox.right : opponentBox.left;
  return player.facing * (opponentFront - playerFront);
}

function getFunctionNumberSource(name: string): NumberSource | null {
  const animelemTimeMatch = name.match(/^animelemtime\((\d+)\)$/);
  if (animelemTimeMatch) {
    const elemNo = Number(animelemTimeMatch[1]);
    return (context) => context.animElemTimes?.[elemNo - 1] ?? null;
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
  const parsed = parseRedirect(name);
  if (!parsed) return null;
  const resolvePlayer = compileRedirectPlayerResolver(parsed);
  const source = compileNumberExpression(parsed.expression);
  if (!source) return null;

  return (context) => {
    const redirectedPlayer = resolvePlayer(context);
    if (!redirectedPlayer) return null;
    return source(createRedirectContext(context, redirectedPlayer));
  };
}

function getRedirectStringSource(name: string): StringSource | null {
  const parsed = parseRedirect(name);
  if (!parsed) return null;
  const resolvePlayer = compileRedirectPlayerResolver(parsed);
  const source = getStringSource(parsed.expression);
  if (!source) return null;

  return (context) => {
    const redirectedPlayer = resolvePlayer(context);
    if (!redirectedPlayer) return null;
    return source(createRedirectContext(context, redirectedPlayer));
  };
}

function getRedirectBooleanSource(name: string): BooleanSource | null {
  const parsed = parseRedirect(name);
  if (!parsed) return null;
  const resolvePlayer = compileRedirectPlayerResolver(parsed);
  const source = compileBooleanExpression(parsed.expression);
  return (context) => {
    const redirectedPlayer = resolvePlayer(context);
    if (!redirectedPlayer) return false;
    return source(createRedirectContext(context, redirectedPlayer));
  };
}

type RedirectKind = 'enemynear' | 'enemy' | 'target' | 'parent' | 'root';

function parseRedirect(name: string): { kind: RedirectKind; argument?: string; expression: string } | null {
  const match = name.match(/^(enemynear|enemy|target|parent|root)(?:\(([^)]*)\))?\s*,\s*(.+)$/);
  if (!match) return null;
  return { kind: match[1] as RedirectKind, argument: match[2]?.trim() || undefined, expression: match[3] };
}

function compileRedirectPlayerResolver(
  parsed: { kind: RedirectKind; argument?: string },
): (context: CnsRuntimeTriggerContext) => PlayerState | undefined {
  const argumentSource = parsed.argument === undefined ? null : compileNumberExpression(parsed.argument);
  return (context) => {
    if (parsed.kind === 'parent' || parsed.kind === 'root') return context.player;
    if (parsed.kind === 'target') {
      const requestedId = parsed.argument === undefined ? undefined : argumentSource?.(context);
      if (parsed.argument !== undefined && (requestedId === null || requestedId === undefined)) return undefined;
      const selected = selectTargets(context.player, requestedId ?? undefined)[0];
      return selected && context.opponent?.id === selected.playerId ? context.opponent : undefined;
    }
    const requestedIndex = parsed.argument === undefined ? 0 : argumentSource?.(context);
    return requestedIndex === 0 ? context.opponent : undefined;
  };
}

export function resolveCnsRuntimeRedirect(
  kind: RedirectKind,
  argument: string | undefined,
  context: CnsRuntimeTriggerContext,
): PlayerState | undefined {
  return resolveRedirectPlayer(kind, argument, context);
}

function resolveRedirectPlayer(
  kind: RedirectKind,
  argument: string | undefined,
  context: CnsRuntimeTriggerContext,
): PlayerState | undefined {
  if (kind === 'parent' || kind === 'root') return context.player;
  if (kind === 'target') {
    const requestedId = argument === undefined ? undefined : readNumberExpression(argument, context);
    if (argument !== undefined && requestedId === null) return undefined;
    const selected = selectTargets(context.player, requestedId ?? undefined)[0];
    return selected && context.opponent?.id === selected.playerId ? context.opponent : undefined;
  }

  const requestedIndex = argument === undefined ? 0 : readNumberExpression(argument, context);
  if (requestedIndex !== 0) return undefined;
  return context.opponent;
}

function createRedirectContext(context: CnsRuntimeTriggerContext, player: PlayerState): CnsRuntimeTriggerContext {
  const animation = context.getRedirectAnimationContext?.(player);
  return {
    ...context,
    player,
    opponent: context.player,
    animTime: animation?.animTime,
    animElemNo: animation?.animElemNo,
    animElemTime: animation?.animElemTime,
    animElemStarted: animation?.animElemStarted,
    animElemCount: animation?.animElemCount,
    animElemTimes: animation?.animElemTimes,
  };
}

export type CnsRedirectDiagnostic = {
  redirect: RedirectKind;
  argument?: string;
  expression: string;
  resolvedEntityId?: number;
  value: number | string | boolean | null;
  result: boolean;
};

export function inspectCnsRuntimeRedirect(
  expression: string,
  context: CnsRuntimeTriggerContext,
): CnsRedirectDiagnostic | null {
  const normalized = normalizeExpression(expression);
  const comparison = splitTopLevelComparison(normalized);
  const sourceExpression = comparison?.left ?? normalized;
  const parsed = parseRedirect(sourceExpression);
  if (!parsed) return null;
  const redirectedPlayer = resolveRedirectPlayer(parsed.kind, parsed.argument, context);
  if (!redirectedPlayer) {
    return { redirect: parsed.kind, argument: parsed.argument, expression: parsed.expression, value: null, result: false };
  }
  const redirectedContext = createRedirectContext(context, redirectedPlayer);
  const stringSource = getStringSource(parsed.expression);
  const booleanSource = getBooleanSource(parsed.expression);
  const numericValue = readNumberExpression(parsed.expression, redirectedContext);
  const value = numericValue ?? stringSource?.(redirectedContext) ?? booleanSource?.(redirectedContext) ?? null;
  return {
    redirect: parsed.kind,
    argument: parsed.argument,
    expression: parsed.expression,
    resolvedEntityId: redirectedPlayer.id,
    value,
    result: evaluateCnsRuntimeTrigger(expression, context),
  };
}

function normalizeExpression(expression: string): string {
  return expression.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/([a-z][a-z0-9.]*)\s+\(/g, '$1(');
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

function readOptionalNumber(player: PlayerState | undefined, key: string, fallback: number): number {
  return (player as PlayerState & Record<string, number | undefined> | undefined)?.[key] ?? fallback;
}

function internalYToMugenY(y: number): number {
  return y - DEFAULT_GROUND_Y;
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

function stateTypeToNumber(stateType: PlayerState['stateType']): number {
  return stateType === 'S' ? 0 : stateType === 'C' ? 1 : stateType === 'A' ? 2 : 3;
}

function moveTypeToNumber(moveType: PlayerState['moveType']): number {
  return moveType === 'I' ? 0 : moveType === 'A' ? 1 : 2;
}
