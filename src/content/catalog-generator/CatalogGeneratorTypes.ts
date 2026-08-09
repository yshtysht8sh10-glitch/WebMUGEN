import type { ContentCatalogDocument, ContentCatalogEntry, ContentEngine, ContentKind } from '../catalog/ContentCatalogTypes';

export type CatalogClassificationKind = ContentKind | 'unknown';

export type CatalogClassificationResult = {
  kind: CatalogClassificationKind;
  engine?: ContentEngine;
  confidence?: number;
  entryFile?: string;
  name?: string;
  warnings: string[];
  errors: string[];
};

export type CatalogSourceFile = {
  path: string;
  name: string;
  bytes: Uint8Array;
  catalogPath?: string;
  expectedKind?: ContentKind;
};

export type CatalogDirectoryRole = ContentKind | 'output';

export type CatalogGeneratedItem = ContentCatalogEntry & {
  sourcePath: string;
};

export type CatalogGeneratorExclusion = {
  path: string;
  result: CatalogClassificationResult;
};

export type CatalogGeneratorDiff = {
  added: string[];
  removed: string[];
  changed: string[];
};

export type CatalogGeneratorResult = {
  catalog: ContentCatalogDocument;
  items: CatalogGeneratedItem[];
  excluded: CatalogGeneratorExclusion[];
  warnings: string[];
  errors: string[];
  diff: CatalogGeneratorDiff;
  scannedFiles: number;
};

export type CatalogFileHandle = {
  kind: 'file';
  name: string;
  getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>;
};

export type CatalogDirectoryHandle = {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<CatalogFileHandle | CatalogDirectoryHandle>;
  getFileHandle?(name: string, options?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  }>;
  queryPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
};
