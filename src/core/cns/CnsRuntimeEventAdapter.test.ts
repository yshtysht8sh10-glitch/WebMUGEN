import { describe, expect, it } from 'vitest';
import { cnsControllerToRuntimeEvent } from './CnsRuntimeEventAdapter';

describe('CnsRuntimeEventAdapter phase62-66', () => {
  it('maps CNS controllers to runtime events', () => {
    expect(cnsControllerToRuntimeEvent({ type: 'Pause', triggers: [], params: { time: 10, movetime: 2 } }, 1))
      .toEqual({ type: 'pause', time: 10, moveTime: 2 });

    expect(cnsControllerToRuntimeEvent({ type: 'Explod', triggers: [], params: { id: 5, anim: 9000, pos: '10, -20', removetime: 30 } }, 1))
      .toEqual({ type: 'explod', id: 5, animNo: 9000, x: 10, y: -20, removeTime: 30 });

    expect(cnsControllerToRuntimeEvent({ type: 'Helper', triggers: [], params: { id: 1000, stateno: 3000, pos: '4, 5' } }, 2))
      .toEqual({ type: 'helper', id: 1000, ownerId: 2, stateNo: 3000, x: 4, y: 5, lifeTime: null });

    expect(cnsControllerToRuntimeEvent({ type: 'TargetDrop', triggers: [], params: {} }, 1))
      .toEqual({ type: 'targetDrop', ownerId: 1 });
  });

  it('keeps explicitly specified zero values as zero', () => {
    expect(cnsControllerToRuntimeEvent({ type: 'Helper', triggers: [], params: { stateno: 3000, lifetime: 0 } }, 1))
      .toMatchObject({ type: 'helper', lifeTime: 0 });
  });
});
