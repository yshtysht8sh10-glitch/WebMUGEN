import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { analyzeCnsCoverage, formatCnsCoverageDiagnostics } from './CnsCoverageDiagnostics';

describe('CnsCoverageDiagnostics', () => {
  it('counts supported and unsupported controllers', () => {
    const cns = parseCnsText(`
[Statedef 0]
type = S
anim = 0

[State 0, Move]
type = VelSet
trigger1 = time = 0
x = 1

[State 0, Sound]
type = PlaySnd
trigger1 = AnimTime = 0
value = 0, 0
`);

    const diagnostics = analyzeCnsCoverage(cns);

    expect(diagnostics.stateCount).toBe(1);
    expect(diagnostics.controllerCount).toBe(2);
    expect(diagnostics.triggerCount).toBe(2);
    expect(diagnostics.controllers.find((item) => item.name === 'velset')?.status).toBe('supported');
    expect(diagnostics.controllers.find((item) => item.name === 'playsnd')?.status).toBe('unsupported');
    expect(diagnostics.triggers.find((item) => item.name === 'time')?.status).toBe('supported');
    expect(diagnostics.triggers.find((item) => item.name === 'animtime')?.status).toBe('supported');
  });

  it('classifies partial trigger families', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
anim = 200

[State 200, Hit]
type = HitDef
trigger1 = AnimElem = 2
trigger2 = Var(3) = 0
attr = S, NA
`);

    const diagnostics = analyzeCnsCoverage(cns);

    expect(diagnostics.controllers.find((item) => item.name === 'hitdef')?.status).toBe('partial');
    expect(diagnostics.triggers.find((item) => item.name === 'animelem')?.status).toBe('partial');
    expect(diagnostics.triggers.find((item) => item.name === 'var')?.status).toBe('partial');
  });

  it('formats short diagnostics lines', () => {
    const cns = parseCnsText(`
[Statedef 0]
type = S
anim = 0

[State 0, Sound]
type = PlaySnd
trigger1 = UnknownTrigger = 1
value = 0, 0
`);

    const lines = formatCnsCoverageDiagnostics(analyzeCnsCoverage(cns));

    expect(lines).toEqual([
      'summary: states=1 controllers=1 triggers=1',
      'unsupported controllers:',
      '  playsnd: 1',
      'unsupported triggers:',
      '  unknowntrigger: 1',
    ]);
  });
});
