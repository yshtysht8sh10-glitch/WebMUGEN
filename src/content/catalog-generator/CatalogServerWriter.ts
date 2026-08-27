import { resolveApplicationAssetPath } from '../../app/ApplicationAssetPath';
import { validateContentCatalog } from '../catalog/ContentCatalogValidator';
import type { ContentCatalogDocument } from '../catalog/ContentCatalogTypes';

export const CATALOG_API_PATH = resolveApplicationAssetPath('api/catalog.php');

type CatalogFetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

export type CatalogServerFetch = (input: string, init?: RequestInit) => Promise<CatalogFetchResponse>;

export type CatalogServerSnapshot = {
  catalog: ContentCatalogDocument;
  revision: string;
};

export class CatalogServerWriteError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = 'catalog.failed') {
    super(message);
    this.name = 'CatalogServerWriteError';
    this.status = status;
    this.code = code;
  }
}

export async function readCatalogServerSnapshot(
  catalogPath: string,
  fetcher: CatalogServerFetch = fetch,
): Promise<CatalogServerSnapshot> {
  const response = await fetcher(catalogPath, { cache: 'no-store' });
  const source = await response.text();
  if (!response.ok) throw new CatalogServerWriteError(source || `HTTP ${response.status}`, response.status);
  const value: unknown = JSON.parse(source);
  const validated = validateContentCatalog(value, catalogPath);
  if (validated.rejectedEntries > 0) {
    throw new CatalogServerWriteError(validated.issues.map((issue) => issue.message).join(' '), 422, 'catalog.invalid');
  }
  return {
    catalog: {
      version: 1,
      items: validated.entries.map((entry) => ({ ...entry })),
    },
    revision: await sha256(source),
  };
}

export async function saveCatalogDraftToServer(
  catalog: ContentCatalogDocument,
  expectedRevision: string,
  token: string,
  fetcher: CatalogServerFetch = fetch,
): Promise<{ revision: string; itemCount: number }> {
  const response = await fetcher(`${CATALOG_API_PATH}?action=save-catalog`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-WebMUGEN-Token': token,
    },
    body: JSON.stringify({ catalog, expectedRevision }),
  });
  const source = await response.text();
  const payload = parseResponse(source);
  if (!response.ok || payload.success !== true) {
    const error = isRecord(payload.error) ? payload.error : {};
    throw new CatalogServerWriteError(
      typeof error.message === 'string' ? error.message : `HTTP ${response.status}`,
      response.status,
      typeof error.code === 'string' ? error.code : 'catalog.failed',
    );
  }
  if (typeof payload.revision !== 'string' || typeof payload.itemCount !== 'number') {
    throw new CatalogServerWriteError('Catalog API returned an invalid save response.', 500);
  }
  return { revision: payload.revision, itemCount: payload.itemCount };
}

async function sha256(source: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseResponse(source: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(source);
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
