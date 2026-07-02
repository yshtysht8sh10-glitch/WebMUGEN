import { describe, expect, it } from 'vitest';
import type { MutableRefObject } from 'react';
import type { CnsRuntimeTrace } from '../core/cns/CnsStateRuntime';
import { appendRuntimeHistoryIfNeeded } from './WebMugenApp';

describe('WebMugenApp runtime history', () => {
  it('stores immutable line snapshots instead of live debug array references', () => {
    const inputLines = ['keys=ArrowRight'];
    const commandLines = ['cmd p1=holdfwd'];
    const physicsLines = ['phys p1 state=20'];
    const cnsLines = ['cns p1 state=0->20'];
    const pressedKeys = new Set(['ArrowRight']);
    const historyRef: MutableRefObject<string[]> = { current: ['seed'] };
    const lastSignatureRef: MutableRefObject<string> = { current: '' };
    let renderedHistory: string[] = [];

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
      setHistoryLines: (lines) => {
        renderedHistory = lines;
      },
    });

    inputLines[0] = 'keys=-';
    commandLines[0] = 'cmd p1=-';
    physicsLines[0] = 'phys p1 state=0';
    cnsLines[0] = 'cns p1 state=20->0';
    pressedKeys.clear();
    historyRef.current[0] = 'mutated seed';

    expect(renderedHistory.join('\n')).toContain('keys=ArrowRight');
    expect(renderedHistory.join('\n')).toContain('cmd p1=holdfwd');
    expect(renderedHistory.join('\n')).toContain('phys p1 state=20');
    expect(renderedHistory.join('\n')).toContain('cns p1 state=0->20');
    expect(renderedHistory.join('\n')).not.toContain('keys=-');
    expect(renderedHistory.join('\n')).not.toContain('mutated seed');
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
