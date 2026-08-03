export type ContentKind = 'character' | 'stage' | 'lifebar';
export type ContentEngine = 'winmugen' | 'webmugen';

export type ContentCatalogEntry = {
  id: string;
  name: string;
  kind: ContentKind;
  engine: ContentEngine;
  path: string;
};

export type ContentCatalogIssue = {
  code: string;
  message: string;
  itemIndex?: number;
};

export type ContentCatalog = {
  version: 1;
  entries: ContentCatalogEntry[];
  totalEntries: number;
  rejectedEntries: number;
  issues: ContentCatalogIssue[];
  sourcePath?: string;
};

export type ContentCatalogDocument = {
  version: 1;
  items: ContentCatalogEntry[];
};

export type ContentCatalogReadResult = {
  catalog: ContentCatalog;
  status: 'success' | 'partial' | 'fallback' | 'error';
  sourcePath: string;
  fallbackUsed: boolean;
  issues: ContentCatalogIssue[];
};

export const CONTENT_CATALOG_VERSION = 1;
export const DEFAULT_CONTENT_CATALOG_PATH = '/content/catalog.json';

export function createEmptyContentCatalog(sourcePath?: string): ContentCatalog {
  return {
    version: CONTENT_CATALOG_VERSION,
    entries: [],
    totalEntries: 0,
    rejectedEntries: 0,
    issues: [],
    ...(sourcePath ? { sourcePath } : {}),
  };
}
