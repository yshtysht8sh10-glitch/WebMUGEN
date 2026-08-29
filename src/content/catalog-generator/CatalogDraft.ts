import { validateContentCatalog } from '../catalog/ContentCatalogValidator';
import type { ContentCatalogDocument, ContentCatalogEntry } from '../catalog/ContentCatalogTypes';
import { serializeContentCatalog } from './CatalogWriter';

export function isCatalogDraftDirty(
  draft: ContentCatalogDocument,
  saved: ContentCatalogDocument,
): boolean {
  return serializeContentCatalog(draft) !== serializeContentCatalog(saved);
}

export function mergeCatalogEntries(
  document: ContentCatalogDocument,
  additions: readonly ContentCatalogEntry[],
): ContentCatalogDocument {
  const items = document.items.map((entry) => ({ ...entry }));
  const indices = new Map(items.map((entry, index) => [entry.id, index]));
  const pathOwners = new Map(items.map((entry) => [catalogPathKey(entry.path), entry.id]));
  for (const addition of additions) {
    const index = indices.get(addition.id);
    const pathKey = catalogPathKey(addition.path);
    const pathOwner = pathOwners.get(pathKey);
    if (pathOwner !== undefined && pathOwner !== addition.id) continue;
    if (index === undefined) {
      indices.set(addition.id, items.length);
      items.push({ ...addition });
    } else {
      pathOwners.delete(catalogPathKey(items[index].path));
      items[index] = { ...addition };
    }
    pathOwners.set(pathKey, addition.id);
  }
  return { version: 1, items };
}

function catalogPathKey(path: string): string {
  return path.trim().replace(/\\/g, '/');
}

export function removeCatalogEntry(document: ContentCatalogDocument, id: string): ContentCatalogDocument {
  return { version: 1, items: document.items.filter((entry) => entry.id !== id) };
}

export function parseCatalogDraft(text: string, sourcePath = '/content/catalog.json'): ContentCatalogDocument {
  const value: unknown = JSON.parse(text);
  const validated = validateContentCatalog(value, sourcePath);
  if (validated.rejectedEntries > 0) {
    throw new Error(validated.issues.map((issue) => issue.message).join(' '));
  }
  if (!isCatalogDocument(value)) throw new Error('A version 1 Catalog document is required.');
  return { version: 1, items: value.items.map((entry) => ({ ...entry })) };
}

function isCatalogDocument(value: unknown): value is ContentCatalogDocument {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && (value as { version?: unknown }).version === 1
    && Array.isArray((value as { items?: unknown }).items));
}
