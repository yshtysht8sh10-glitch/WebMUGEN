import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILTIN_CONTENT_ENTRIES } from '../catalog/BuiltinContentCatalog';
import type { ContentCatalogDocument } from '../catalog/ContentCatalogTypes';
import { isCatalogDraftDirty, mergeCatalogEntries, parseCatalogDraft, removeCatalogEntry } from './CatalogDraft';

const document: ContentCatalogDocument = {
  version: 1,
  items: [{ id: 'hero', name: 'Hero', kind: 'character', engine: 'winmugen', path: '/chars/hero.zip', source: 'external' }],
};

describe('Catalog draft editing', () => {
  it('removes one specified item without changing the others', () => {
    const withBuiltins = mergeCatalogEntries(document, BUILTIN_CONTENT_ENTRIES);
    expect(removeCatalogEntry(withBuiltins, 'hero').items.map((entry) => entry.id)).not.toContain('hero');
    expect(removeCatalogEntry(withBuiltins, 'hero').items).toHaveLength(BUILTIN_CONTENT_ENTRIES.length);
  });

  it('re-adds the canonical built-in entries without duplicates', () => {
    const once = mergeCatalogEntries(document, BUILTIN_CONTENT_ENTRIES);
    const twice = mergeCatalogEntries(once, BUILTIN_CONTENT_ENTRIES);
    expect(twice).toEqual(once);
  });

  it('detects whether the draft contains changes not reflected in catalog.json', () => {
    expect(isCatalogDraftDirty(document, { ...document, items: document.items.map((entry) => ({ ...entry })) })).toBe(false);
    expect(isCatalogDraftDirty(removeCatalogEntry(document, 'hero'), document)).toBe(true);
  });

  it('accepts only a fully valid version 1 Catalog from the text editor', () => {
    expect(parseCatalogDraft(JSON.stringify(document))).toEqual(document);
    expect(() => parseCatalogDraft('{"version":1,"items":[{"id":"bad"}]}')).toThrow('invalid name');
  });

  it('keeps the bundled-entry source in sync with the publisher Catalog', () => {
    const published = JSON.parse(readFileSync(resolve('public/content/catalog.json'), 'utf8')) as ContentCatalogDocument;
    expect(published.items.filter((entry) => entry.source === 'builtin')).toEqual(BUILTIN_CONTENT_ENTRIES);
  });
});
