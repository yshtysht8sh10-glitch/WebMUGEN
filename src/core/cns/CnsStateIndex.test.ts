import { describe, expect, it } from 'vitest';

import { mergeCnsDocuments } from '../character/CharacterLoader';
import { findCnsState, prepareCnsDocumentStateIndex } from '../../mugen/common/CnsStateIndex';
import { parseCnsText } from '../../parser/cns/CnsParser';

describe('Issue #58 Phase 5 CNS State index', () => {
  it('uses one prepared Map and preserves first duplicate StateNo selection', () => {
    const cns = parseCnsText(`
[StateDef 100]
anim = 10
[StateDef 100]
anim = 20
[StateDef -1]
`);
    const index = prepareCnsDocumentStateIndex(cns);

    expect(index.size).toBe(2);
    expect(index.get(100)).toBe(cns.states[0]);
    expect(index.get(100)?.initialAnim).toBe(10);
    expect(findCnsState(cns, -1)).toBe(cns.states[2]);
    expect(prepareCnsDocumentStateIndex(cns)).toBe(index);
  });

  it('keeps the base document State when merged documents contain the same StateNo', () => {
    const base = parseCnsText('[StateDef 200]\nanim = 1');
    const extra = parseCnsText('[StateDef 200]\nanim = 2\n[StateDef 201]\nanim = 3');
    const merged = mergeCnsDocuments(base, extra);

    expect(findCnsState(merged, 200)).toBe(base.states[0]);
    expect(findCnsState(merged, 201)).toBe(extra.states[1]);
  });

  it('rebuilds once when a document State array is replaced', () => {
    const cns = parseCnsText('[StateDef 0]\nanim = 0');
    const originalIndex = prepareCnsDocumentStateIndex(cns);
    const replacement = parseCnsText('[StateDef 1]\nanim = 1').states[0];
    cns.states = [replacement];

    const rebuilt = prepareCnsDocumentStateIndex(cns);
    expect(rebuilt).not.toBe(originalIndex);
    expect(findCnsState(cns, 0)).toBeUndefined();
    expect(findCnsState(cns, 1)).toBe(replacement);
    expect(prepareCnsDocumentStateIndex(cns)).toBe(rebuilt);
  });
});
