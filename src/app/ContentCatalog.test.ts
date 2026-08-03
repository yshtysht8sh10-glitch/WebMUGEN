import { describe, expect, it } from 'vitest';
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
    { id: 'hero', name: 'Hero', kind: 'character', engine: 'winmugen', path: 'chars/hero.zip' },
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
    ] }, '/content/catalog.json');
    expect(entriesOfKind(catalog, 'character').map((entry) => entry.id)).toEqual(['hero']);
    expect(entriesOfKind(catalog, 'stage').map((entry) => entry.id)).toEqual(['arena']);
    expect(entriesOfKind(catalog, 'lifebar').map((entry) => entry.id)).toEqual(['hud']);
    expect(catalog).toMatchObject({ totalEntries: 6, rejectedEntries: 3 });
    expect(catalog.issues.map((issue) => issue.code)).toEqual(['item.kind', 'item.path', 'item.duplicate-id']);
  });

  it('supports an empty Catalog and safely resolves a missing current selection to the first allowed item', () => {
    expect(validateContentCatalog({ version: 1, items: [] }, '/content/catalog.json').entries).toEqual([]);
    const catalog = validateContentCatalog(validDocument, '/content/catalog.json');
    const selection = resolveCatalogSelection(catalog, { characterId: 'removed', stageId: 'removed', lifeBarId: 'removed' });
    expect([selection.character?.id, selection.stage?.id, selection.lifeBar?.id]).toEqual(['hero', 'arena', 'hud']);
    expect(selection.fallbackKinds).toEqual(['character', 'stage', 'lifebar']);
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
      .toBe('[WebMUGEN] Fresh (fresh)');
    expect(formatCatalogEntryLabel({ id: 'arena', name: 'Arena', kind: 'stage', engine: 'winmugen', path: '/stages/arena.def' }))
      .toBe('[WinMUGEN] Arena (arena)');
  });
});
