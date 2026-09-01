import type { ContentKind } from '../catalog/ContentCatalogTypes';

export type CatalogPublicBases = Record<ContentKind, string>;
type CatalogPublicBaseStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const CATALOG_PUBLIC_BASES_STORAGE_KEY = 'webmugen.catalog-generator.public-bases.v1';

export function loadCatalogPublicBases(
  defaults: CatalogPublicBases,
  storage: CatalogPublicBaseStorage | undefined = readLocalStorage(),
): CatalogPublicBases {
  if (!storage) return { ...defaults };
  try {
    const value: unknown = JSON.parse(storage.getItem(CATALOG_PUBLIC_BASES_STORAGE_KEY) ?? 'null');
    if (!isRecord(value)) return { ...defaults };
    return {
      character: migrateLegacyApplicationBase(safePublicBase(value.character), '/chars', defaults.character),
      stage: migrateLegacyApplicationBase(safePublicBase(value.stage), '/stages', defaults.stage),
      lifebar: migrateLegacyApplicationBase(safePublicBase(value.lifebar), '/lifebars', defaults.lifebar),
    };
  } catch {
    return { ...defaults };
  }
}

function migrateLegacyApplicationBase(value: string | undefined, legacy: string, fallback: string): string {
  return value === legacy && fallback !== legacy ? fallback : value ?? fallback;
}

export function saveCatalogPublicBases(
  bases: CatalogPublicBases,
  storage: CatalogPublicBaseStorage | undefined = readLocalStorage(),
): boolean {
  if (!storage) return false;
  const normalized = {
    character: safePublicBase(bases.character),
    stage: safePublicBase(bases.stage),
    lifebar: safePublicBase(bases.lifebar),
  };
  if (!normalized.character || !normalized.stage || !normalized.lifebar) return false;
  try {
    storage.setItem(CATALOG_PUBLIC_BASES_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

function safePublicBase(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\\/g, '/');
  const base = normalized === '/' ? '/' : normalized.replace(/\/+$/, '');
  if (!base.startsWith('/') || base.startsWith('//') || base.includes('://') || /[?#]/.test(base)) return undefined;
  if (base.split('/').some((part) => part === '.' || part === '..')) return undefined;
  return base;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readLocalStorage(): CatalogPublicBaseStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
