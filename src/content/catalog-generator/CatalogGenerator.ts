import type { ContentCatalogDocument, ContentCatalogEntry } from '../catalog/ContentCatalogTypes';
import { classifyCatalogSourceFile } from './CatalogContentClassifier';
import type {
  CatalogGeneratedItem,
  CatalogGeneratorDiff,
  CatalogGeneratorResult,
  CatalogSourceFile,
} from './CatalogGeneratorTypes';

export function generateContentCatalog(
  files: readonly CatalogSourceFile[],
  existingCatalog?: ContentCatalogDocument,
  preservedItems: readonly ContentCatalogEntry[] = [],
): CatalogGeneratorResult {
  const items: CatalogGeneratedItem[] = preservedItems.map((entry) => ({ ...entry, sourcePath: entry.path }));
  const excluded: CatalogGeneratorResult['excluded'] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set(preservedItems.map((entry) => entry.id));

  for (const file of files) {
    const result = classifyCatalogSourceFile(file);
    const catalogPath = file.catalogPath ?? file.path;
    if (!isSafeGeneratedPath(catalogPath)) {
      const message = `Unsafe generated path: ${catalogPath}.`;
      errors.push(message);
      excluded.push({ path: file.path, result: { ...result, kind: 'unknown', errors: [...result.errors, message] } });
      continue;
    }
    if (result.kind === 'unknown' || !result.engine) {
      excluded.push({ path: file.path, result });
      continue;
    }
    if (file.expectedKind && result.kind !== file.expectedKind) {
      const message = `Expected ${file.expectedKind}, but detected ${result.kind}.`;
      excluded.push({ path: file.path, result: { ...result, kind: 'unknown', errors: [...result.errors, message] } });
      continue;
    }
    const id = createCatalogId(file.path);
    if (!id || ids.has(id)) {
      const message = id ? `Duplicate generated ID: ${id}.` : `Cannot generate a safe ID for ${file.path}.`;
      errors.push(message);
      excluded.push({ path: file.path, result: { ...result, kind: 'unknown', errors: [...result.errors, message] } });
      continue;
    }
    ids.add(id);
    items.push({
      id,
      kind: result.kind,
      engine: result.engine,
      name: result.name ?? createDisplayName(file.path),
      path: catalogPath,
      source: 'external',
      sourcePath: file.path,
    });
    warnings.push(...result.warnings.map((warning) => `${file.path}: ${warning}`));
  }

  const catalog: ContentCatalogDocument = {
    version: 1,
    items: items.map(({ sourcePath: _sourcePath, ...entry }) => entry),
  };
  return {
    catalog,
    items,
    excluded,
    warnings,
    errors,
    diff: compareCatalogs(existingCatalog, catalog),
    scannedFiles: files.length,
  };
}

function isSafeGeneratedPath(path: string): boolean {
  return Boolean(path) && !path.startsWith('\\') && !path.startsWith('//') && !path.includes('://')
    && !path.replace(/\\/g, '/').split('/').some((part) => part === '..' || part === '.');
}

export function resolveCatalogPublicPath(basePath: string, relativePath: string): string {
  const normalizedBase = basePath.trim().replace(/\\/g, '/');
  const base = normalizedBase === '/' ? '' : normalizedBase.replace(/\/+$/, '');
  const relative = relativePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if ((!base.startsWith('/') && normalizedBase !== '/') || base.startsWith('//') || base.includes('://') || /[?#]/.test(base)
    || base.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`Unsafe public base path: ${basePath}.`);
  }
  return `${base}/${relative}`;
}

export function compareCatalogs(previous: ContentCatalogDocument | undefined, next: ContentCatalogDocument): CatalogGeneratorDiff {
  const before = new Map((previous?.items ?? []).map((item) => [item.id, item]));
  const after = new Map(next.items.map((item) => [item.id, item]));
  return {
    added: [...after.keys()].filter((id) => !before.has(id)),
    removed: [...before.keys()].filter((id) => !after.has(id)),
    changed: [...after.keys()].filter((id) => before.has(id) && !sameEntry(before.get(id)!, after.get(id)!)),
  };
}

function createCatalogId(path: string): string {
  const parts = path.split('/');
  const fileName = parts.pop() ?? '';
  const baseName = fileName.replace(/\.(?:def|zip|json)$/i, '');
  const identityName = /^(?:stage|lifebar|fight)$/i.test(baseName) ? parts.pop() ?? baseName : baseName;
  return identityName.toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function createDisplayName(path: string): string {
  const parts = path.split('/');
  const fileName = parts.pop() ?? '';
  const fileBase = fileName.replace(/\.(?:def|zip|json)$/i, '');
  const identityName = /^(?:stage|lifebar|fight)$/i.test(fileBase) ? parts.pop() ?? fileBase : fileBase;
  const base = identityName.replace(/[-_]+/g, ' ').trim();
  return base.replace(/\b\w/g, (value) => value.toUpperCase()) || 'Unnamed content';
}

function sameEntry(left: ContentCatalogEntry, right: ContentCatalogEntry): boolean {
  return left.name === right.name && left.kind === right.kind && left.engine === right.engine && left.path === right.path && left.source === right.source;
}
