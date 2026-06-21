import type { HitDefSpec } from '../hitdef/HitDefTypes';
import type { RuntimeEvent } from './RuntimeEventQueue';

export type RuntimeHitDefEvent = Extract<RuntimeEvent, { type: 'hitDef' }>;

export function createHitDefRuntimeEvent(ownerId: 1 | 2, hitDef: HitDefSpec): RuntimeHitDefEvent {
  return { type: 'hitDef', ownerId, hitDef };
}

export function isHitDefRuntimeEvent(event: RuntimeEvent | RuntimeHitDefEvent): event is RuntimeHitDefEvent {
  return event.type === 'hitDef';
}
