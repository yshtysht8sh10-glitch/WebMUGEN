import { describe, expect, it, vi } from 'vitest';
import {
  CATALOG_PUBLIC_BASES_STORAGE_KEY,
  loadCatalogPublicBases,
  saveCatalogPublicBases,
} from './CatalogPublicBaseStore';

const defaults = { character: '/chars', stage: '/stages', lifebar: '/lifebars' };

describe('Catalog public URL base storage', () => {
  it('restores the public URL bases saved after a successful Catalog apply', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const configured = {
      character: '/DotoEita/16_proxy_release/storage/data/',
      stage: '/DotoEita/16_proxy_release/storage/data',
      lifebar: '/lifebars',
    };

    expect(saveCatalogPublicBases(configured, storage)).toBe(true);
    expect(loadCatalogPublicBases(defaults, storage)).toEqual({
      character: '/DotoEita/16_proxy_release/storage/data',
      stage: '/DotoEita/16_proxy_release/storage/data',
      lifebar: '/lifebars',
    });
    expect(values.has(CATALOG_PUBLIC_BASES_STORAGE_KEY)).toBe(true);
  });

  it('falls back safely for invalid or unavailable stored settings', () => {
    expect(loadCatalogPublicBases(defaults, { getItem: () => '{bad', setItem: vi.fn() })).toEqual(defaults);
    expect(loadCatalogPublicBases(defaults, {
      getItem: () => JSON.stringify({ character: 'https://evil.test', stage: '../stages', lifebar: '/saved-lifebars' }),
      setItem: vi.fn(),
    })).toEqual({ character: '/chars', stage: '/stages', lifebar: '/saved-lifebars' });
    expect(saveCatalogPublicBases(defaults, { getItem: vi.fn(), setItem: () => { throw new Error('quota'); } })).toBe(false);
  });

  it('migrates legacy bundled roots to the current application subdirectory', () => {
    const subdirectoryDefaults = {
      character: '/DotoEita/50_WebMUGEN/chars',
      stage: '/DotoEita/50_WebMUGEN/stages',
      lifebar: '/DotoEita/50_WebMUGEN/lifebars',
    };
    const storage = {
      getItem: () => JSON.stringify({ character: '/chars', stage: '/stages', lifebar: '/lifebars' }),
      setItem: vi.fn(),
    };

    expect(loadCatalogPublicBases(subdirectoryDefaults, storage)).toEqual(subdirectoryDefaults);
  });
});
