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

  it('identifies Helper traces separately from their root player', () => {
    expect(formatCnsRuntimeDebugOverlay([{
      playerId: 1,
      entityId: 17,
      helperId: 1472,
      stateNo: 1476,
      afterStateNo: 1476,
      animNo: 1462,
      afterAnimNo: 1462,
      stateTime: 49,
      afterStateTime: 49,
      mugenAnimTime: 0,
      stateFound: true,
      executedControllers: [],
      debugLines: [],
    }])).toEqual(['cns p1 H1472#17 state=1476->1476 anim=1462->1462 time=49->49 animtime=0 found=1 exec=-']);
  });
});
