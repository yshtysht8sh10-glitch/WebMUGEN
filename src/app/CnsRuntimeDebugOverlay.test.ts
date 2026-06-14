import { describe, expect, it } from 'vitest';
import { formatCnsRuntimeDebugOverlay } from './CnsRuntimeDebugOverlay';

describe('CnsRuntimeDebugOverlay', () => {
  it('formats empty traces', () => {
    expect(formatCnsRuntimeDebugOverlay([])).toEqual(['cns=-']);
  });

  it('formats runtime traces with after state', () => {
    expect(
      formatCnsRuntimeDebugOverlay([
        {
          playerId: 1,
          stateNo: 0,
          afterStateNo: 200,
          stateFound: true,
          executedControllers: ['ChangeState'],
        },
      ]),
    ).toEqual(['cns p1 state=0->200 found=1 exec=ChangeState']);
  });
});
