import { describe, expect, it, vi } from 'vitest';
import {
  entriesOfKind,
  formatCatalogEntryLabel,
  loadContentCatalog,
  readContentCatalog,
  resolveCatalogSelection,
  validateContentCatalog,
} from './ContentCatalog';

const validDocument = {
  version: 1,
  items: [
    { id: 'hero', name: 'Hero', kind: 'character', engine: 'winmugen', path: 'chars/hero.zip', source: 'builtin' },
    { id: 'arena', name: 'Arena', kind: 'stage', engine: 'winmugen', path: 'stages/arena.def' },
    { id: 'hud', name: 'HUD', kind: 'lifebar', engine: 'webmugen', path: 'lifebars/hud.json' },
  ],
};

const response = (value: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => value,
});

describe('Content Catalog Reader and Validator', () => {
  it('loads a versioned Catalog and resolves relative item paths against the Catalog URL', async () => {
    const catalog = await loadContentCatalog('/packs/catalog.json', async () => response(validDocument));
    expect(catalog.entries.map((entry) => [entry.kind, entry.path])).toEqual([
      ['character', '/packs/chars/hero.zip'],
      ['stage', '/packs/stages/arena.def'],
      ['lifebar', '/packs/lifebars/hud.json'],
    ]);
    expect(catalog).toMatchObject({ totalEntries: 3, rejectedEntries: 0, sourcePath: '/packs/catalog.json' });
    expect(catalog.entries[0].source).toBe('builtin');
    expect(catalog.entries.every((entry) => (entry.visibility ?? 'public') === 'public')).toBe(true);
  });

  it('migrates legacy bundled roots beneath a subdirectory deployment without rewriting proxy paths', () => {
    const catalog = validateContentCatalog({ version: 1, items: [
      { id: 'hero', name: 'Hero', kind: 'character', engine: 'winmugen', path: '/chars/hero.zip' },
      { id: 'arena', name: 'Arena', kind: 'stage', engine: 'winmugen', path: '/stages/arena.zip' },
      { id: 'proxy', name: 'Proxy', kind: 'stage', engine: 'winmugen', path: '/DotoEita/16_proxy_release/storage/data/arena.zip' },
    ] }, '/DotoEita/50_WebMUGEN/content/catalog.json');

    expect(catalog.entries.map((entry) => entry.path)).toEqual([
      '/DotoEita/50_WebMUGEN/chars/hero.zip',
      '/DotoEita/50_WebMUGEN/stages/arena.zip',
      '/DotoEita/16_proxy_release/storage/data/arena.zip',
    ]);
  });

  it('bypasses HTTP caches so a just-published Character is immediately selectable', async () => {
    const fetcher = vi.fn(async () => response(validDocument));
    await loadContentCatalog('/content/catalog.json', fetcher);
    expect(fetcher).toHaveBeenCalledWith('/content/catalog.json', expect.objectContaining({ cache: 'no-store' }));
  });

  it.each([
    ['version mismatch', { version: 2, items: [] }, 'Unsupported Catalog version'],
    ['items missing', { version: 1 }, 'items array is required'],
  ])('rejects a top-level Catalog %s', async (_label, document, message) => {
    await expect(loadContentCatalog('/content/catalog.json', async () => response(document))).rejects.toThrow(message);
  });

  it('reports invalid JSON, 404, unsafe URLs, and timeouts without scanning content files', async () => {
    await expect(loadContentCatalog('/content/catalog.json', async () => ({
      ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); },
    }))).rejects.toThrow('bad json');
    await expect(loadContentCatalog('/content/catalog.json', async () => response({}, 404))).rejects.toThrow('HTTP 404');
    await expect(loadContentCatalog('https://evil.example/catalog.json')).rejects.toThrow('Unsafe Catalog path');
    await expect(loadContentCatalog('/content/catalog.json', () => new Promise(() => undefined), 5)).rejects.toThrow('timed out');
  });

  it('keeps valid character, stage, and lifebar items while excluding unknown, invalid, and duplicate items', () => {
    const catalog = validateContentCatalog({ version: 1, items: [
      ...validDocument.items,
      { id: 'unknown', name: 'Unknown', kind: 'mystery', engine: 'winmugen', path: 'unknown.def' },
      { id: 'bad-path', name: 'Bad Path', kind: 'stage', engine: 'winmugen', path: '../stage.def' },
      { id: 'hero', name: 'Duplicate', kind: 'character', engine: 'winmugen', path: 'chars/other.zip' },
      { id: 'hero-copy', name: 'Duplicate Path', kind: 'character', engine: 'winmugen', path: 'chars/hero.zip' },
    ] }, '/content/catalog.json');
    expect(entriesOfKind(catalog, 'character').map((entry) => entry.id)).toEqual(['hero']);
    expect(entriesOfKind(catalog, 'stage').map((entry) => entry.id)).toEqual(['arena']);
    expect(entriesOfKind(catalog, 'lifebar').map((entry) => entry.id)).toEqual(['hud']);
    expect(catalog).toMatchObject({ totalEntries: 7, rejectedEntries: 4 });
    expect(catalog.issues.map((issue) => issue.code)).toEqual(['item.kind', 'item.path', 'item.duplicate-id', 'item.duplicate-path']);
  });

  it('supports an empty Catalog and safely resolves a missing current selection to the first allowed item', () => {
    expect(validateContentCatalog({ version: 1, items: [] }, '/content/catalog.json').entries).toEqual([]);
    const catalog = validateContentCatalog(validDocument, '/content/catalog.json');
    const selection = resolveCatalogSelection(catalog, { characterId: 'removed', stageId: 'removed', lifeBarId: 'removed' });
    expect([selection.character?.id, selection.stage?.id, selection.lifeBar?.id]).toEqual(['hero', 'arena', 'hud']);
    expect(selection.fallbackKinds).toEqual(['character', 'stage', 'lifebar']);
  });

  it('keeps unlisted content in the Catalog while excluding it from normal selection', () => {
    const catalog = validateContentCatalog({ version: 1, items: [
      { id: 'public-char', name: 'Public', kind: 'character', engine: 'winmugen', path: '/chars/public.zip' },
      { id: 'test-char', name: 'Test', kind: 'character', engine: 'winmugen', path: '/chars/test.zip', visibility: 'unlisted' },
      { id: 'stage', name: 'Stage', kind: 'stage', engine: 'webmugen', path: 'builtin:stage:fresh' },
    ] }, '/content/catalog.json');

    expect(catalog.entries.map((entry) => entry.id)).toEqual(['public-char', 'test-char', 'stage']);
    expect(entriesOfKind(catalog, 'character').map((entry) => entry.id)).toEqual(['public-char']);
    expect(resolveCatalogSelection(catalog, { characterId: 'test-char', stageId: 'stage', lifeBarId: '' }).character?.id)
      .toBe('public-char');
    expect(resolveCatalogSelection(
      catalog,
      { characterId: 'test-char', stageId: 'stage', lifeBarId: '' },
      { character: 'test-char' },
    ).character?.id).toBe('test-char');
  });

  it('uses the previous successful Catalog when reload, HTTP, JSON, or timeout fails', async () => {
    const previous = validateContentCatalog(validDocument, '/content/catalog.json');
    const result = await readContentCatalog('/content/changed.json', {
      previousCatalog: previous,
      fetcher: async () => response({}, 404),
    });
    expect(result).toMatchObject({ status: 'fallback', fallbackUsed: true, catalog: previous });
    expect(result.issues[0].message).toContain('HTTP 404');
  });

  it('loads a changed Catalog URL and exposes partial validation status', async () => {
    const result = await readContentCatalog('/content/alternate.json', { fetcher: async () => response({
      version: 1,
      items: [validDocument.items[0], { id: '', kind: 'stage' }],
    }) });
    expect(result).toMatchObject({ status: 'partial', sourcePath: '/content/alternate.json', fallbackUsed: false });
    expect(result.catalog.entries).toHaveLength(1);
  });

  it('labels selectable content with its execution engine', () => {
    expect(formatCatalogEntryLabel({ id: 'fresh', name: 'Fresh', kind: 'stage', engine: 'webmugen', path: 'builtin:stage:fresh' }))
      .toBe('[WebMUGEN] Fresh');
    expect(formatCatalogEntryLabel({ id: 'arena', name: 'Arena', kind: 'stage', engine: 'winmugen', path: '/stages/arena.def' }))
      .toBe('[WinMUGEN] Arena');
    expect(formatCatalogEntryLabel({ id: 'alice', name: 'Alice', kind: 'character', engine: 'mugen_1_0', path: '/chars/alice.zip' }))
      .toBe('[MUGEN 1.0] Alice');
  });

  it('rejects an unknown built-in/external source marker', () => {
    const catalog = validateContentCatalog({ version: 1, items: [
      { id: 'hero', name: 'Hero', kind: 'character', engine: 'winmugen', path: '/chars/hero.zip', source: 'private' },
    ] }, '/content/catalog.json');
    expect(catalog.entries).toEqual([]);
    expect(catalog.issues[0].code).toBe('item.source');
  });

  it('rejects an unknown visibility marker', () => {
    const catalog = validateContentCatalog({ version: 1, items: [
      { id: 'hero', name: 'Hero', kind: 'character', engine: 'winmugen', path: '/chars/hero.zip', visibility: 'private' },
    ] }, '/content/catalog.json');
    expect(catalog.entries).toEqual([]);
    expect(catalog.issues[0].code).toBe('item.visibility');
  });
});
