import { describe, expect, it } from 'vitest';
import { createActiveHitDefStore, getActiveHitDef } from '../hitdef/ActiveHitDefStore';
import { createDefaultHitDefSpec } from '../hitdef/HitDefTypes';
import { createHitDefRuntimeEvent } from './RuntimeHitDefEvents';
import { applyHitDefRuntimeEvents } from './RuntimeHitDefIntegration';

describe('Phase76 RuntimeHitDefIntegration', () => {
  it('stores HitDef runtime events as active HitDefs', () => {
    const spec = { ...createDefaultHitDefSpec(), damage: { hit: 12, guard: 2 } };
    const store = applyHitDefRuntimeEvents(
      createActiveHitDefStore(),
      [
        { type: 'pause', time: 3, moveTime: 0 },
        createHitDefRuntimeEvent(1, spec),
      ],
      99,
    );

    expect(getActiveHitDef(store, 1)).toMatchObject({
      ownerId: 1,
      createdAt: 99,
      spec: { damage: { hit: 12, guard: 2 } },
    });
  });
});
