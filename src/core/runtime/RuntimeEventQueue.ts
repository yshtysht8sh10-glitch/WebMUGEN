import type { HitDefSpec } from '../hitdef/HitDefTypes';

export type RuntimeEvent =
  | { type: 'pause'; time: number; moveTime: number }
  | { type: 'superpause'; time: number; moveTime: number; darken: boolean }
  | { type: 'explod'; id: number | null; animNo: number; x: number; y: number; removeTime: number | null }
  | { type: 'removeExplod'; id: number }
  | { type: 'helper'; id: number | null; ownerId: 1 | 2; stateNo: number; x: number; y: number; lifeTime: number | null }
  | { type: 'destroyHelper'; id: number }
  | { type: 'targetBind'; ownerId: 1 | 2; targetId: 1 | 2; time: number; x: number; y: number }
  | { type: 'targetDrop'; ownerId: 1 | 2 }
  | { type: 'hitDef'; ownerId: 1 | 2; hitDef: HitDefSpec };

export type RuntimeEventQueue = { events: RuntimeEvent[] };

export function createRuntimeEventQueue(): RuntimeEventQueue {
  return { events: [] };
}

export function enqueueRuntimeEvent(queue: RuntimeEventQueue, event: RuntimeEvent): RuntimeEventQueue {
  return { events: [...queue.events, event] };
}

export function drainRuntimeEvents(queue: RuntimeEventQueue): { events: RuntimeEvent[]; queue: RuntimeEventQueue } {
  return { events: queue.events, queue: createRuntimeEventQueue() };
}
