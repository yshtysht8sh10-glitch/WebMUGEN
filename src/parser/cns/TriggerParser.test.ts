import { describe, expect, it } from 'vitest';
import { parseTriggerExpression } from './TriggerParser';

describe('parseTriggerExpression', () => {
  it('parses time equality', () => {
    expect(parseTriggerExpression('time = 0')).toEqual({
      kind: 'Binary',
      operator: '=',
      left: { kind: 'Identifier', name: 'time' },
      right: { kind: 'NumberLiteral', value: 0 },
    });
  });

  it('parses command string', () => {
    expect(parseTriggerExpression('command = "holdfwd"')).toEqual({
      kind: 'Binary',
      operator: '=',
      left: { kind: 'Identifier', name: 'command' },
      right: { kind: 'StringLiteral', value: 'holdfwd' },
    });
  });

  it('parses not equal with state type literal', () => {
    expect(parseTriggerExpression('statetype != A')).toEqual({
      kind: 'Binary',
      operator: '!=',
      left: { kind: 'Identifier', name: 'statetype' },
      right: { kind: 'StringLiteral', value: 'A' },
    });
  });

  it('parses boolean shorthand identifier', () => {
    expect(parseTriggerExpression('ctrl')).toEqual({
      kind: 'Identifier',
      name: 'ctrl',
    });
  });
});
