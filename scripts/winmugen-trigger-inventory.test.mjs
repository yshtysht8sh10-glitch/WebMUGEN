import { describe, expect, it } from 'vitest';
import { evaluateCnsRuntimeTrigger } from '../src/core/cns/CnsRuntimeTrigger.ts';
import { parseCnsText } from '../src/parser/cns/CnsParser.ts';
import { auditInventory, buildInventory } from './winmugen-trigger-inventory.mjs';

describe('WinMUGEN Trigger inventory', () => {
  it('tracks every inventory and evaluator entry in the canonical Matrix', async () => {
    const { errors } = await auditInventory();
    expect(errors).toEqual([]);
  }, 15_000);

  it('keeps the six Issue #82 audit classifications explicit', () => {
    const records = buildInventory();
    const allowed = new Set([
      'Not implemented',
      'Parser only',
      'Safe fallback',
      'Partial',
      'Complete',
      'Not applicable',
    ]);
    expect(records.length).toBeGreaterThan(150);
    expect(records.every((record) => allowed.has(record.matrixStatus))).toBe(true);
    expect(records.filter((record) => record.version === 'WinMUGEN 2002.04.14').length).toBe(122);
  });

  it('keeps unknown expressions unsupported after the inventory reaches zero parser-only rows', () => {
    const records = buildInventory();
    const parserOnly = records.filter((record) => record.matrixStatus === 'Parser only');
    expect(parserOnly).toHaveLength(0);
    expect(evaluateCnsRuntimeTrigger('DefinitelyUnknownTrigger = 1', { player: {} })).toBe(false);
  });

  it('proves the production CNS parser retains every inventoried syntax string', () => {
    const records = buildInventory();
    const triggerLines = records.map((record, index) => `trigger${index + 1} = ${record.syntax}`);
    const document = parseCnsText([
      '[Statedef 999]',
      'type = S',
      '[State 999, Issue82 inventory]',
      'type = Null',
      ...triggerLines,
    ].join('\n'));
    const parsed = document.states[0].controllers[0].triggers;
    expect(parsed).toHaveLength(records.length);
    expect(parsed.map((trigger) => trigger.expression)).toEqual(records.map((record) => record.syntax));
  });
});
