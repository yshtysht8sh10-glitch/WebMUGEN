import type { CnsStateController } from '../../mugen/common/cnsTypes';
import { parseHitDefController } from '../hitdef/HitDefParser';
import { createHitDefRuntimeEvent, type RuntimeHitDefEvent } from '../runtime/RuntimeHitDefEvents';

export function cnsHitDefControllerToRuntimeEvent(
  controller: CnsStateController,
  ownerId: 1 | 2,
): RuntimeHitDefEvent | null {
  const hitDef = parseHitDefController(controller);
  return hitDef ? createHitDefRuntimeEvent(ownerId, hitDef) : null;
}
