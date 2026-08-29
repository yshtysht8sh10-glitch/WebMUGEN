import {
  CONTENT_CATALOG_VERSION,
  type ContentCatalog,
  type ContentCatalogEntry,
  type ContentCatalogIssue,
  type ContentEngine,
  type ContentKind,
} from './ContentCatalogTypes';

export class ContentCatalogValidationError extends Error {
  readonly issues: ContentCatalogIssue[];

  constructor(message: string, issues: ContentCatalogIssue[] = [{ code: 'catalog.invalid', message }]) {
    super(message);
    this.name = 'ContentCatalogValidationError';
    this.issues = issues;
  }
}

export function validateContentCatalog(value: unknown, sourcePath: string): ContentCatalog {
  if (!isRecord(value)) throw new ContentCatalogValidationError('Catalog must be a JSON object.');
  if (value.version !== CONTENT_CATALOG_VERSION) {
    throw new ContentCatalogValidationError(`Unsupported Catalog version: ${String(value.version)}.`);
  }
  if (!Array.isArray(value.items)) throw new ContentCatalogValidationError('Catalog items array is required.');

  const entries: ContentCatalogEntry[] = [];
  const issues: ContentCatalogIssue[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (let index = 0; index < value.items.length; index += 1) {
    const normalized = validateCatalogEntry(value.items[index], sourcePath, index);
    if ('issue' in normalized) {
      issues.push(normalized.issue);
      continue;
    }
    if (ids.has(normalized.entry.id)) {
      issues.push({ code: 'item.duplicate-id', itemIndex: index, message: `Duplicate content ID: ${normalized.entry.id}.` });
      continue;
    }
    if (paths.has(normalized.entry.path)) {
      issues.push({ code: 'item.duplicate-path', itemIndex: index, message: `Duplicate content path: ${normalized.entry.path}.` });
      continue;
    }
    ids.add(normalized.entry.id);
    paths.add(normalized.entry.path);
    entries.push(normalized.entry);
  }

  return {
    version: CONTENT_CATALOG_VERSION,
    entries,
    totalEntries: value.items.length,
    rejectedEntries: issues.length,
    issues,
    sourcePath,
  };
}

export function isSafeCatalogPath(path: string): boolean {
  return path.startsWith('/') && path.toLowerCase().endsWith('.json') && !hasUnsafePathPart(path) && !path.includes('://');
}

export function resolveCatalogEntryPath(path: string, sourcePath: string): string | null {
  const normalized = path.trim().replace(/\\/g, '/');
  if (!normalized || hasUnsafePathPart(normalized) || normalized.includes('://') || normalized.startsWith('//')) return null;
  if (normalized.startsWith('builtin:')) return normalized;
  if (normalized.startsWith('/')) return normalized;
  const directory = sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1);
  return `${directory}${normalized}`;
}

function validateCatalogEntry(
  value: unknown,
  sourcePath: string,
  itemIndex: number,
): { entry: ContentCatalogEntry } | { issue: ContentCatalogIssue } {
  const reject = (message: string, code = 'item.invalid') => ({ issue: { code, itemIndex, message } });
  if (!isRecord(value)) return reject('Catalog item must be an object.');
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const kind = readKind(value.kind);
  const engine = readEngine(value.engine);
  const rawPath = typeof value.path === 'string' ? value.path : '';
  const source = value.source === 'builtin' || value.source === 'external' ? value.source : undefined;
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) return reject('Catalog item has an invalid ID.', 'item.id');
  if (!name || name.length > 120) return reject(`Catalog item ${id} has an invalid name.`, 'item.name');
  if (!kind) return reject(`Catalog item ${id} has an unknown kind.`, 'item.kind');
  if (!engine) return reject(`Catalog item ${id} has an unknown engine.`, 'item.engine');
  if (value.source !== undefined && !source) return reject(`Catalog item ${id} has an unknown source.`, 'item.source');
  const path = resolveCatalogEntryPath(rawPath, sourcePath);
  if (!path || !isPathCompatible(path, kind, engine)) {
    return reject(`Catalog item ${id} has an invalid ${engine} ${kind} path.`, 'item.path');
  }
  return { entry: { id, name, kind, engine, path, ...(source ? { source } : {}) } };
}

function readKind(value: unknown): ContentKind | null {
  return value === 'character' || value === 'stage' || value === 'lifebar' ? value : null;
}

function readEngine(value: unknown): ContentEngine | null {
  return value === 'winmugen' || value === 'webmugen' ? value : null;
}

function isPathCompatible(path: string, kind: ContentKind, engine: ContentEngine): boolean {
  const lower = path.toLowerCase();
  if (engine === 'webmugen') {
    return path.startsWith(`builtin:${kind}:`) || (path.startsWith('/') && lower.endsWith('.json'));
  }
  if (!path.startsWith('/')) return false;
  if (kind === 'lifebar') return lower.endsWith('.def');
  return lower.endsWith('.def') || lower.endsWith('.zip');
}

function hasUnsafePathPart(path: string): boolean {
  return path.split('/').some((part) => part === '..' || part === '.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
