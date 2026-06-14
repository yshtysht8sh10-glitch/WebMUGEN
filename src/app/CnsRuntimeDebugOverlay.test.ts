import { describe, expect, it } from 'vitest';
import { formatCnsRuntimeDebugOverlay } from './CnsRuntimeDebugOverlay';

describe('CnsRuntimeDebugOverlay', () => {
  it('formats runtime traces', () => {
    const lines = formatCnsRuntimeDebugOverlay([
      {
        playerId: 1,
        stateNo: 20,
        stateFound: true,
        executedControllers: ['ChangeAnim', 'VelSet'],
      },
    ]);

    expect(lines[0]).toBe('cns p1 state=20 found=1 exec=ChangeAnim,VelSet');
  });

  it('formats no executed controllers', () => {
    const lines = formatCnsRuntimeDebugOverlay([
      {
        playerId: 2,
        stateNo: 0,
        stateFound: false,
        executedControllers: [],
      },
    ]);

    expect(lines[0]).toBe('cns p2 state=0 found=0 exec=-');
  });
});
