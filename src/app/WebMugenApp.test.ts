import { describe, expect, it } from 'vitest';
import type { MutableRefObject } from 'react';
import type { CnsRuntimeTrace } from '../core/cns/CnsStateRuntime';
import { appendRuntimeHistoryIfNeeded, createSourceOutline, findAirActionForLine, stripReadableRuntimeValueSummaries } from './WebMugenApp';

describe('WebMugenApp runtime history', () => {
  it('stores immutable line snapshots instead of live debug array references', () => {
    const inputLines = ['keys=ArrowRight'];
    const commandLines = ['cmd p1=holdfwd'];
    const physicsLines = ['phys p1 state=20'];
    const cnsLines = ['cns p1 state=0->20'];
    const pressedKeys = new Set(['ArrowRight']);
    const historyRef: MutableRefObject<string[]> = { current: ['seed'] };
    const lastSignatureRef: MutableRefObject<string> = { current: '' };
    let renderInvalidations = 0;

    appendRuntimeHistoryIfNeeded({
      frameNo: 10,
      inputLines,
      commandLines,
      physicsLines,
      roundLine: 'round=1 phase=fight',
      scoreLine: 'score p1=0 p2=0 draw=0',
      cnsLines,
      traces: [createTrace({ stateNo: 0, afterStateNo: 20 })],
      pressedKeys,
      historyRef,
      lastSignatureRef,
      setHistoryLines: () => {
        renderInvalidations += 1;
      },
    });
    const appendedSnapshot = historyRef.current.slice();

    inputLines[0] = 'keys=-';
    commandLines[0] = 'cmd p1=-';
    physicsLines[0] = 'phys p1 state=0';
    cnsLines[0] = 'cns p1 state=20->0';
    pressedKeys.clear();
    historyRef.current[0] = 'mutated seed';

    expect(renderInvalidations).toBe(1);
    expect(appendedSnapshot.join('\n')).toContain('keys=ArrowRight');
    expect(appendedSnapshot.join('\n')).toContain('cmd p1=holdfwd');
    expect(appendedSnapshot.join('\n')).toContain('phys p1 state=20');
    expect(appendedSnapshot.join('\n')).toContain('cns p1 state=0->20');
    expect(appendedSnapshot.join('\n')).not.toContain('keys=-');
    expect(appendedSnapshot.join('\n')).not.toContain('mutated seed');
  });

  it('does not append when only time-like values changed', () => {
    const historyRef: MutableRefObject<string[]> = { current: [] };
    const lastSignatureRef: MutableRefObject<string> = { current: '' };
    let renderInvalidations = 0;

    appendRuntimeHistoryIfNeeded({
      frameNo: 10,
      inputLines: ['keys=ArrowRight'],
      commandLines: ['cmd p1=holdfwd'],
      physicsLines: ['phys p1 state=20 time=10 anim=20:10'],
      roundLine: 'round=1 phase=fight timer=90 winner=-',
      scoreLine: 'score p1=0 p2=0 draw=0',
      cnsLines: ['cns p1 state=20->20 anim=20->20 time=10->10 animtime=10 found=1'],
      traces: [createTrace({ stateNo: 20, afterStateNo: 20, animNo: 20, afterAnimNo: 20, stateTime: 10, afterStateTime: 10, mugenAnimTime: 10 })],
      pressedKeys: new Set(['ArrowRight']),
      historyRef,
      lastSignatureRef,
      setHistoryLines: () => {
        renderInvalidations += 1;
      },
    });

    appendRuntimeHistoryIfNeeded({
      frameNo: 11,
      inputLines: ['keys=ArrowRight'],
      commandLines: ['cmd p1=holdfwd'],
      physicsLines: ['phys p1 state=20 time=11 anim=20:11'],
      roundLine: 'round=1 phase=fight timer=89 winner=-',
      scoreLine: 'score p1=0 p2=0 draw=0',
      cnsLines: ['cns p1 state=20->20 anim=20->20 time=11->11 animtime=11 found=1'],
      traces: [createTrace({ stateNo: 20, afterStateNo: 20, animNo: 20, afterAnimNo: 20, stateTime: 11, afterStateTime: 11, mugenAnimTime: 11 })],
      pressedKeys: new Set(['ArrowRight']),
      historyRef,
      lastSignatureRef,
      setHistoryLines: () => {
        renderInvalidations += 1;
      },
    });

    expect(renderInvalidations).toBe(1);
    expect(historyRef.current.join('\n')).toContain('frame=10');
    expect(historyRef.current.join('\n')).not.toContain('frame=11');
  });

  it('ignores readable trigger value summaries for history identity', () => {
    expect(stripReadableRuntimeValueSummaries([
      '**ChangeState -> 0** | NG @ char.cns:10',
      'OK `trigger1=AnimTime = 0 || values: animtime=-4  time=20`',
    ].join('\n'))).toBe([
      '**ChangeState -> 0** | NG @ char.cns:10',
      'OK `trigger1=AnimTime = 0',
    ].join('\n'));
  });

  it('builds source outlines for AIR, CNS, and CMD files', () => {
    expect(createSourceOutline({
      path: 'demo.air',
      label: 'demo.air',
      kind: 'air',
      text: '[Begin Action 106]\n0,0,0,0,5\nBegin Action 107\n0,0,0,0,5',
    }).map((item) => `${item.label}:${item.line}`)).toEqual([
      'Begin Action 106:1',
      'Begin Action 107:3',
    ]);

    expect(createSourceOutline({
      path: 'demo.cns',
      label: 'demo.cns',
      kind: 'cns',
      text: '[StateDef 50]\ntype = A\n[StateDef 52]\ntype = S',
    }).map((item) => `${item.label}:${item.line}`)).toEqual([
      'StateDef 50:1',
      'StateDef 52:3',
    ]);

    expect(createSourceOutline({
      path: 'demo.cmd',
      label: 'demo.cmd',
      kind: 'cmd',
      text: '[Command]\nname = "FF"\ncommand = F, F',
    }).map((item) => `${item.label}:${item.line}`)).toEqual(['Command FF:1']);
  });

  it('finds the active AIR action for a source line', () => {
    const outline = createSourceOutline({
      path: 'demo.air',
      label: 'demo.air',
      kind: 'air',
      text: 'Begin Action 100\n0,0,0,0,5\nBegin Action 101\n0,0,0,0,5',
    });

    expect(findAirActionForLine(outline, 1)).toBe(100);
    expect(findAirActionForLine(outline, 2)).toBe(100);
    expect(findAirActionForLine(outline, 3)).toBe(101);
  });
});

function createTrace(patch: Partial<CnsRuntimeTrace>): CnsRuntimeTrace {
  return {
    playerId: 1,
    stateNo: 0,
    afterStateNo: 0,
    animNo: 0,
    afterAnimNo: 0,
    stateTime: 0,
    afterStateTime: 0,
    mugenAnimTime: 0,
    stateFound: true,
    executedControllers: [],
    debugLines: [],
    ...patch,
  };
}
