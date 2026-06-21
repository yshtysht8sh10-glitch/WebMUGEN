import { describe, expect, it } from 'vitest';
import { createRuntimeEventQueue, drainRuntimeEvents, enqueueRuntimeEvent } from './RuntimeEventQueue';

describe('Phase62 RuntimeEventQueue', () => {
  it('enqueues and drains runtime events', () => {
    const queue = enqueueRuntimeEvent(createRuntimeEventQueue(), { type: 'pause', time: 10, moveTime: 2 });

    expect(queue.events).toEqual([{ type: 'pause', time: 10, moveTime: 2 }]);

    const drained = drainRuntimeEvents(queue);
    expect(drained.events).toHaveLength(1);
    expect(drained.queue.events).toHaveLength(0);
  });
});
