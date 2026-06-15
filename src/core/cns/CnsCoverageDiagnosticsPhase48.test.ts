import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { analyzeCnsCoverage } from './CnsCoverageDiagnostics';

describe('CnsCoverageDiagnostics phase48', () => {
  it('marks new core triggers as supported', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
anim = 200

[State 200, Check]
type = VelSet
trigger1 = Anim = 200
trigger2 = StateNo = 200
trigger3 = Pos X >= 0
trigger4 = Vel Y < 0
trigger5 = Facing = 1
x = 0
`);

    const diagnostics = analyzeCnsCoverage(cns);

    expect(diagnostics.triggers.find((item) => item.name === 'anim')?.status).toBe('supported');
    expect(diagnostics.triggers.find((item) => item.name === 'stateno')?.status).toBe('supported');
    expect(diagnostics.triggers.find((item) => item.name === 'pos')?.status).toBe('supported');
    expect(diagnostics.triggers.find((item) => item.name === 'vel')?.status).toBe('supported');
    expect(diagnostics.triggers.find((item) => item.name === 'facing')?.status).toBe('supported');
  });
});
