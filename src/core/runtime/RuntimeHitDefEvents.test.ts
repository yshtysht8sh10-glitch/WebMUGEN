import { describe, expect, it } from 'vitest';
import { createDefaultHitDefSpec } from '../hitdef/HitDefTypes';
import { createHitDefRuntimeEvent, isHitDefRuntimeEvent } from './RuntimeHitDefEvents';

describe('Phase73 RuntimeHitDefEvents', () => {
  it('creates and narrows HitDef runtime events', () => {
    const event = createHitDefRuntimeEvent(2, createDefaultHitDefSpec());

    expect(event.ownerId).toBe(2);
    expect(isHitDefRuntimeEvent(event)).toBe(true);
    expect(isHitDefRuntimeEvent({ type: 'pause', time: 1, moveTime: 0 })).toBe(false);
  });
});
