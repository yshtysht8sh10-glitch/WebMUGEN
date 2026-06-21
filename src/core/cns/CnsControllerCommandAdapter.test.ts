import { describe, expect, it } from 'vitest';
import { toRuntimeControllerCommand } from './CnsControllerCommandAdapter';

describe('Phase61 CNS controller command adapter', () => {
  it('converts pause and superpause controllers', () => {
    expect(toRuntimeControllerCommand({ type: 'Pause', triggers: [], params: { time: 12, movetime: 3 } }))
      .toEqual({ type: 'pause', time: 12, moveTime: 3 });

    expect(toRuntimeControllerCommand({ type: 'SuperPause', triggers: [], params: { time: 40, movetime: 5, darken: 0 } }))
      .toEqual({ type: 'superpause', time: 40, moveTime: 5, darken: false });
  });

  it('converts helper and target controllers', () => {
    expect(toRuntimeControllerCommand({ type: 'Helper', triggers: [], params: { id: 1000, stateno: 3000, pos: '10, -20' } }))
      .toEqual({ type: 'helper', id: 1000, stateNo: 3000, x: 10, y: -20 });

    expect(toRuntimeControllerCommand({ type: 'TargetDrop', triggers: [], params: {} }))
      .toEqual({ type: 'targetdrop' });

    expect(toRuntimeControllerCommand({ type: 'TargetBind', triggers: [], params: { time: 4, pos: '1, 2' } }))
      .toEqual({ type: 'targetbind', time: 4, x: 1, y: 2 });
  });
});
