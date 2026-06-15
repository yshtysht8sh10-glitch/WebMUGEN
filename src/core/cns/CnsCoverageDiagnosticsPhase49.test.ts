import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { analyzeCnsCoverage } from './CnsCoverageDiagnostics';

describe('CnsCoverageDiagnostics phase49', () => {
  it('marks new core controllers as supported', () => {
    const cns = parseCnsText(`
[Statedef 0]
type = S
anim = 0

[State 0, StateType]
type = StateTypeSet
trigger1 = 1
statetype = A

[State 0, MoveType]
type = MoveTypeSet
trigger1 = 1
value = A

[State 0, Life]
type = LifeAdd
trigger1 = 1
value = 1

[State 0, Power]
type = PowerAdd
trigger1 = 1
value = 1

[State 0, Set]
type = VarSet
trigger1 = 1
v = 1
value = 2

[State 0, Add]
type = VarAdd
trigger1 = 1
v = 1
value = 3
`);

    const diagnostics = analyzeCnsCoverage(cns);

    expect(diagnostics.controllers.find((item) => item.name === 'statetypeset')?.status).toBe('supported');
    expect(diagnostics.controllers.find((item) => item.name === 'movetypeset')?.status).toBe('supported');
    expect(diagnostics.controllers.find((item) => item.name === 'lifeadd')?.status).toBe('supported');
    expect(diagnostics.controllers.find((item) => item.name === 'poweradd')?.status).toBe('supported');
    expect(diagnostics.controllers.find((item) => item.name === 'varset')?.status).toBe('supported');
    expect(diagnostics.controllers.find((item) => item.name === 'varadd')?.status).toBe('supported');
  });
});
