import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { analyzeCnsCoverage } from './CnsCoverageDiagnostics';

describe('CnsCoverageDiagnostics phase50', () => {
  it('keeps side-effect controllers visible in diagnostics', () => {
    const cns = parseCnsText(`
[Statedef 0]
type = S
anim = 0

[State 0, Sound]
type = PlaySnd
trigger1 = 1
value = 0, 0

[State 0, Priority]
type = SprPriority
trigger1 = 1
value = 3

[State 0, Width]
type = Width
trigger1 = 1
edge = 10

[State 0, Assert]
type = AssertSpecial
trigger1 = 1
flag = noautoturn
`);

    const diagnostics = analyzeCnsCoverage(cns);

    expect(diagnostics.controllers.some((item) => item.name === 'playsnd')).toBe(true);
    expect(diagnostics.controllers.some((item) => item.name === 'sprpriority')).toBe(true);
    expect(diagnostics.controllers.some((item) => item.name === 'width')).toBe(true);
    expect(diagnostics.controllers.some((item) => item.name === 'assertspecial')).toBe(true);
  });
});
