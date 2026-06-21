import { describe, expect, it } from 'vitest';
import { createDefaultHitDefSpec } from '../hitdef/HitDefTypes';
import { createRuntimeEventQueue, drainRuntimeEvents, enqueueRuntimeEvent } from './RuntimeEventQueue';

describe('Phase73 RuntimeEventQueue HitDef extension', () => {
  it('enqueues and drains HitDef runtime events', () => {
    const queue = enqueueRuntimeEvent(createRuntimeEventQueue(), {
      type: 'hitDef',
      ownerId: 1,
      hitDef: createDefaultHitDefSpec(),
    });

    expect(queue.events[0]).toMatchObject({ type: 'hitDef', ownerId: 1 });

    const drained = drainRuntimeEvents(queue);
    expect(drained.events).toHaveLength(1);
    expect(drained.queue.events).toHaveLength(0);
  });
});
