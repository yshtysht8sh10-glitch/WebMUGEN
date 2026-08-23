import {
  createEmptyContentCatalog,
  type ContentCatalog,
  type ContentCatalogIssue,
  type ContentCatalogReadResult,
} from './ContentCatalogTypes';
import { ContentCatalogValidationError, isSafeCatalogPath, validateContentCatalog } from './ContentCatalogValidator';

export type CatalogFetchResponse = { ok: boolean; status: number; json(): Promise<unknown> };
export type CatalogFetch = (input: string, init?: RequestInit) => Promise<CatalogFetchResponse>;

export type ReadContentCatalogOptions = {
  fetcher?: CatalogFetch;
  previousCatalog?: ContentCatalog;
  timeoutMs?: number;
};

export async function readContentCatalog(
  path: string,
  options: ReadContentCatalogOptions = {},
): Promise<ContentCatalogReadResult> {
  const previousCatalog = options.previousCatalog;
  try {
    const catalog = await loadContentCatalog(path, options.fetcher ?? fetch, options.timeoutMs ?? 8000);
    return {
      catalog,
      status: catalog.rejectedEntries > 0 ? 'partial' : 'success',
      sourcePath: path,
      fallbackUsed: false,
      issues: catalog.issues,
    };
  } catch (error) {
    const issues = readIssues(error);
    return {
      catalog: previousCatalog ?? createEmptyContentCatalog(path),
      status: previousCatalog ? 'fallback' : 'error',
      sourcePath: path,
      fallbackUsed: Boolean(previousCatalog),
      issues,
    };
  }
}

export async function loadContentCatalog(
  path: string,
  fetcher: CatalogFetch = fetch,
  timeoutMs = 8000,
): Promise<ContentCatalog> {
  if (!isSafeCatalogPath(path)) throw new ContentCatalogValidationError(`Unsafe Catalog path: ${path}.`);
  const controller = typeof AbortController === 'undefined' ? undefined : new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Catalog request timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([fetcher(path, {
      cache: 'no-store',
      ...(controller ? { signal: controller.signal } : {}),
    }), timeout]);
    if (!response.ok) throw new Error(`Catalog request failed: HTTP ${response.status}.`);
    return validateContentCatalog(await response.json(), path);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function readIssues(error: unknown): ContentCatalogIssue[] {
  if (error instanceof ContentCatalogValidationError) return error.issues;
  return [{ code: 'catalog.read', message: error instanceof Error ? error.message : String(error) }];
}
