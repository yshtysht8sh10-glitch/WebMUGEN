import { describe, expect, it } from 'vitest';
import { cnsHitDefControllerToRuntimeEvent } from './CnsHitDefRuntimeAdapter';

describe('Phase74 CnsHitDefRuntimeAdapter', () => {
  it('maps HitDef controllers to HitDef runtime events', () => {
    expect(cnsHitDefControllerToRuntimeEvent({
      type: 'HitDef',
      triggers: [],
      params: {
        attr: 'S, NA',
        damage: '20, 5',
      },
    }, 1)).toMatchObject({
      type: 'hitDef',
      ownerId: 1,
      hitDef: {
        attr: { stateType: 'S', category: 'NA' },
        damage: { hit: 20, guard: 5 },
      },
    });
  });

  it('ignores non-HitDef controllers', () => {
    expect(cnsHitDefControllerToRuntimeEvent({ type: 'Pause', triggers: [], params: {} }, 1)).toBeNull();
  });
});
