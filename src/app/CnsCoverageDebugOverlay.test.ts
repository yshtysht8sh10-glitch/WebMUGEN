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
        controllers: [
          { name: 'velset', count: 1, status: 'supported' },
          { name: 'playsnd', count: 2, status: 'unsupported' },
        ],
        triggers: [
          { name: 'time', count: 3, status: 'supported', examples: ['time = 0'] },
          { name: 'animelem', count: 1, status: 'unsupported', examples: ['AnimElem = 2'] },
        ],
        unsupportedControllers: [{ name: 'playsnd', count: 2, status: 'unsupported' }],
        unsupportedTriggers: [{ name: 'animelem', count: 1, status: 'unsupported', examples: ['AnimElem = 2'] }],
      }),
    ).toEqual([
      'CNS機能の対応状況です。数字は、このキャラのCNS内で出てきた回数です。',
      'StateDef: 2',
      'Controller使用回数: 3 / 種類: 2',
      'Trigger使用回数: 4 / 種類: 2',
      '',
      'Controllers:',
      '  対応済み: 1種類',
      '    velset: 1',
      '  一部対応: 0種類',
      '  -',
      '  未対応: 1種類',
      '    playsnd: 2',
      '',
      'Triggers:',
      '  対応済み: 1種類',
      '    time: 3',
      '  一部対応: 0種類',
      '  -',
      '  未対応: 1種類',
      '    animelem: 1',
    ]);
  });
});
