import type { ContentCatalog, ContentCatalogEntry, ContentKind } from './ContentCatalogTypes';

export type CatalogSelectionIds = {
  characterId: string;
  stageId: string;
  lifeBarId: string;
};

export type ResolvedCatalogSelection = {
  character?: ContentCatalogEntry;
  stage?: ContentCatalogEntry;
  lifeBar?: ContentCatalogEntry;
  fallbackKinds: ContentKind[];
};

export function entriesOfKind(catalog: ContentCatalog, kind: ContentKind): ContentCatalogEntry[] {
  return catalog.entries.filter((entry) => entry.kind === kind);
}

export function findCatalogEntry(catalog: ContentCatalog, kind: ContentKind, id: string): ContentCatalogEntry | undefined {
  return catalog.entries.find((entry) => entry.kind === kind && entry.id === id);
}

export function resolveCatalogSelection(catalog: ContentCatalog, ids: CatalogSelectionIds): ResolvedCatalogSelection {
  const fallbackKinds: ContentKind[] = [];
  const resolve = (kind: ContentKind, id: string) => {
    const exact = findCatalogEntry(catalog, kind, id);
    if (exact) return exact;
    const fallback = entriesOfKind(catalog, kind)[0];
    if (fallback) fallbackKinds.push(kind);
    return fallback;
  };
  return {
    character: resolve('character', ids.characterId),
    stage: resolve('stage', ids.stageId),
    lifeBar: resolve('lifebar', ids.lifeBarId),
    fallbackKinds,
  };
}

export function formatCatalogEntryLabel(entry: ContentCatalogEntry): string {
  const engineLabel = entry.engine === 'winmugen' ? 'WinMUGEN' : entry.engine === 'mugen_1_0' ? 'MUGEN 1.0' : 'WebMUGEN';
  return `[${engineLabel}] ${entry.name}`;
}
