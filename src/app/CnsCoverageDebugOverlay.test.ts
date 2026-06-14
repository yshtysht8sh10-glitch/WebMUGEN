import { describe, expect, it } from 'vitest';
import { formatCnsCoverageDebugOverlay } from './CnsCoverageDebugOverlay';

describe('CnsCoverageDebugOverlay', () => {
  it('formats missing diagnostics', () => {
    expect(formatCnsCoverageDebugOverlay(null)).toEqual(['coverage=-']);
  });

  it('formats diagnostics', () => {
    expect(
      formatCnsCoverageDebugOverlay({
        stateCount: 2,
        controllerCount: 3,
        triggerCount: 4,
        controllers: [],
        triggers: [],
        unsupportedControllers: [{ name: 'playsnd', count: 2, status: 'unsupported' }],
        unsupportedTriggers: [{ name: 'animelem', count: 1, status: 'unsupported', examples: ['AnimElem = 2'] }],
      }),
    ).toEqual([
      'coverage states=2 controllers=3 triggers=4',
      'coverage unsupported controllers=playsnd(2)',
      'coverage unsupported triggers=animelem(1)',
    ]);
  });
});
