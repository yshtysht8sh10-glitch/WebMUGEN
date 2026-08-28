import { describe, expect, it, vi } from 'vitest';
import type { ContentCatalogDocument } from '../catalog/ContentCatalogTypes';
import { CATALOG_API_PATH, CatalogServerWriteError, readCatalogServerSnapshot, saveCatalogDraftToServer } from './CatalogServerWriter';

const catalog: ContentCatalogDocument = {
  version: 1,
  items: [{ id: 'hero', name: 'Hero', kind: 'character', engine: 'winmugen', path: '/chars/hero.zip', source: 'external' }],
};

describe('Catalog server writer', () => {
  it('hashes the exact loaded Catalog bytes for optimistic locking', async () => {
    const source = `${JSON.stringify(catalog, null, 2)}\n`;
    const snapshot = await readCatalogServerSnapshot('/content/catalog.json', async () => response(200, source));
    expect(snapshot.catalog).toEqual(catalog);
    expect(snapshot.revision).toMatch(/^[a-f0-9]{64}$/);
  });

  it('sends the draft and revision through both supported bearer-token headers', async () => {
    const fetcher = vi.fn(async () => response(200, JSON.stringify({ success: true, revision: 'b'.repeat(64), itemCount: 1 })));
    await expect(saveCatalogDraftToServer(catalog, 'a'.repeat(64), 'wmd1.session-token.signature', fetcher)).resolves.toEqual({ revision: 'b'.repeat(64), itemCount: 1 });
    expect(fetcher).toHaveBeenCalledWith(`${CATALOG_API_PATH}?action=save-catalog`, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer wmd1.session-token.signature', 'X-WebMUGEN-Token': 'wmd1.session-token.signature' }),
      body: JSON.stringify({ catalog, expectedRevision: 'a'.repeat(64) }),
    }));
  });

  it('surfaces a server conflict without exposing the token in the error', async () => {
    const fetcher = vi.fn(async () => response(409, JSON.stringify({ success: false, error: { code: 'catalog.conflict', message: 'Catalog changed.' } })));
    const error = await saveCatalogDraftToServer(catalog, 'a'.repeat(64), 'secret-token', fetcher).catch((caught) => caught);
    expect(error).toBeInstanceOf(CatalogServerWriteError);
    expect(error).toMatchObject({ status: 409, code: 'catalog.conflict' });
    expect(String(error)).not.toContain('secret-token');
  });
});

function response(status: number, body: string) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}
