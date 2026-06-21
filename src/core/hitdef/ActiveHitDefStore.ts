import type { HitDefSpec } from './HitDefTypes';

export type ActiveHitDef = {
  ownerId: 1 | 2;
  spec: HitDefSpec;
  createdAt: number;
};

export type ActiveHitDefStore = {
  active: ActiveHitDef[];
};

export function createActiveHitDefStore(): ActiveHitDefStore {
  return { active: [] };
}

export function setActiveHitDef(
  store: ActiveHitDefStore,
  ownerId: 1 | 2,
  spec: HitDefSpec,
  createdAt: number,
): ActiveHitDefStore {
  return {
    active: [
      ...store.active.filter((hitDef) => hitDef.ownerId !== ownerId),
      { ownerId, spec, createdAt },
    ],
  };
}

export function getActiveHitDef(store: ActiveHitDefStore, ownerId: 1 | 2): ActiveHitDef | null {
  return store.active.find((hitDef) => hitDef.ownerId === ownerId) ?? null;
}

export function clearActiveHitDef(store: ActiveHitDefStore, ownerId: 1 | 2): ActiveHitDefStore {
  return {
    active: store.active.filter((hitDef) => hitDef.ownerId !== ownerId),
  };
}
