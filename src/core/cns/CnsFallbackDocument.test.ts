import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { attachFallbackAttackStates } from './CnsFallbackDocument';

describe('CnsFallbackDocument', () => {
  it('creates fallback document when source CNS is missing', () => {
    const cns = attachFallbackAttackStates(null);

    expect(cns.states.some((state) => state.stateNo === 0)).toBe(true);
    expect(cns.states.some((state) => state.stateNo === 200)).toBe(true);
  });

  it('does not overwrite existing state numbers', () => {
    const source = parseCnsText(`
[Statedef 200]
type = S
movetype = I
physics = S
ctrl = 1
anim = 999
`);

    const cns = attachFallbackAttackStates(source);
    const states200 = cns.states.filter((state) => state.stateNo === 200);

    expect(states200).toHaveLength(1);
    expect(states200[0].initialAnim).toBe(999);
  });

  it('adds missing fallback states to existing CNS', () => {
    const source = parseCnsText(`
[Statedef 999]
type = S
anim = 999
`);

    const cns = attachFallbackAttackStates(source);

    expect(cns.states.some((state) => state.stateNo === 999)).toBe(true);
    expect(cns.states.some((state) => state.stateNo === 200)).toBe(true);
  });
});
