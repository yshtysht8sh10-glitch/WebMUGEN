import { describe, expect, it } from 'vitest';
import { formatCnsRuntimeDebugOverlay } from './CnsRuntimeDebugOverlay';

describe('CnsRuntimeDebugOverlay', () => {
  it('formats runtime traces with MUGEN animtime', () => {
    expect(
      formatCnsRuntimeDebugOverlay([
        {
          playerId: 1,
          stateNo: 200,
          afterStateNo: 0,
          animNo: 200,
          afterAnimNo: 0,
          stateTime: 19,
          afterStateTime: 0,
          mugenAnimTime: 0,
          stateFound: true,
          executedControllers: ['ChangeState'],
        },
      ]),
    ).toEqual(['cns p1 state=200->0 anim=200->0 time=19->0 animtime=0 found=1 exec=ChangeState']);
  });
});
