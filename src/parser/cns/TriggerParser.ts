import type { TriggerExpression } from './TriggerExpression';

const binaryOperators = ['!=', '>=', '<=', '=', '>', '<'] as const;
const knownIdentifiers = new Set([
  'time',
  'animtime',
  'ctrl',
  'statetype',
  'movetype',
  'physics',
  'movehit',
  'command',
  'pos y',
  'pos x',
  'vel y',
  'vel x',
]);

export function parseTriggerExpression(text: string): TriggerExpression {
  const expression = text.trim();

  for (const operator of binaryOperators) {
    const index = findOperatorIndex(expression, operator);
    if (index >= 0) {
      return {
        kind: 'Binary',
        operator,
        left: parseTriggerExpression(expression.slice(0, index)),
        right: parseTriggerExpression(expression.slice(index + operator.length)),
      };
    }
  }

  const numericValue = Number(expression);
  if (!Number.isNaN(numericValue)) {
    return { kind: 'NumberLiteral', value: numericValue };
  }

  if (
    (expression.startsWith('"') && expression.endsWith('"')) ||
    (expression.startsWith("'") && expression.endsWith("'"))
  ) {
    return {
      kind: 'StringLiteral',
      value: expression.slice(1, -1),
    };
  }

  const normalized = expression.toLowerCase();

  if (knownIdentifiers.has(normalized)) {
    return {
      kind: 'Identifier',
      name: normalized,
    };
  }

  return {
    kind: 'StringLiteral',
    value: expression,
  };
}

function findOperatorIndex(expression: string, operator: string): number {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index <= expression.length - operator.length; index += 1) {
    const char = expression[index];

    if ((char === '"' || char === "'") && (index === 0 || expression[index - 1] !== '\\')) {
      quote = quote === char ? null : char;
      continue;
    }

    if (quote !== null) {
      continue;
    }

    if (expression.slice(index, index + operator.length) === operator) {
      return index;
    }
  }

  return -1;
}
