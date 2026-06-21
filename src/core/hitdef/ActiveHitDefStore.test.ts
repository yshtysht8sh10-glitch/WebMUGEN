import { describe, expect, it } from 'vitest';
import { createDefaultHitDefSpec } from './HitDefTypes';
import { clearActiveHitDef, createActiveHitDefStore, getActiveHitDef, setActiveHitDef } from './ActiveHitDefStore';

describe('Phase72 ActiveHitDefStore', () => {
  it('sets, replaces, reads, and clears active HitDefs by owner', () => {
    const first = createDefaultHitDefSpec();
    const second = { ...createDefaultHitDefSpec(), damage: { hit: 40, guard: 8 } };

    const withFirst = setActiveHitDef(createActiveHitDefStore(), 1, first, 10);
    expect(getActiveHitDef(withFirst, 1)?.spec.damage.hit).toBe(0);

    const replaced = setActiveHitDef(withFirst, 1, second, 11);
    expect(replaced.active).toHaveLength(1);
    expect(getActiveHitDef(replaced, 1)?.spec.damage.hit).toBe(40);

    expect(getActiveHitDef(clearActiveHitDef(replaced, 1), 1)).toBeNull();
  });
});
