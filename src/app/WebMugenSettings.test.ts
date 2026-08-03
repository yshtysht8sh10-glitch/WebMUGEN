import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUT_CONFIG } from './BrowserInput';
import {
  FALLBACK_WEBMUGEN_SETTINGS,
  LEGACY_SETTINGS_KEYS,
  WEBMUGEN_SETTINGS_STORAGE_KEY,
  loadWebMugenSettings,
  migrateWebMugenSettings,
  normalizeWebMugenSettings,
  publishWebMugenDefaults,
  resetWebMugenSettings,
  saveWebMugenSettings,
  applyFeaturePolicyToSettings,
  applyCatalogSelectionToSettings,
  synchronizeContentIdsFromRuntime,
} from './WebMugenSettings';
import { createFeatureFlags } from './BuildMode';

describe('WebMugenSettings', () => {
  it('uses published defaults when no user settings exist', async () => {
    const storage = memoryStorage();
    const loaded = await loadWebMugenSettings({
      storage,
      fetcher: published({ audio: { masterVolumePercent: 80 }, runtime: { roundTime: 60 } }),
    });
    expect(loaded.publishedDefaultsLoaded).toBe(true);
    expect(loaded.settings.audio.masterVolumePercent).toBe(80);
    expect(loaded.settings.runtime.roundTime).toBe(60);
    expect(loaded.settings.runtime.hudTheme).toBe('cyber');
  });

  it('falls back safely when published settings cannot be loaded', async () => {
    const loaded = await loadWebMugenSettings({
      storage: memoryStorage(),
      fetcher: async () => { throw new Error('offline'); },
      browserLanguage: 'ja-JP',
    });
    expect(loaded.publishedDefaultsLoaded).toBe(false);
    expect(loaded.settings.runtime.roundTime).toBe(FALLBACK_WEBMUGEN_SETTINGS.runtime.roundTime);
    expect(loaded.settings.ui.language).toBe('ja');
  });

  it('merges saved nested values over new published fields', async () => {
    const storage = memoryStorage({
      [WEBMUGEN_SETTINGS_STORAGE_KEY]: JSON.stringify({ version: 1, audio: { masterVolumePercent: 25 } }),
    });
    const loaded = await loadWebMugenSettings({
      storage,
      fetcher: published({ audio: { masterVolumePercent: 80, muted: true }, runtime: { roundTime: 45 } }),
    });
    expect(loaded.settings.audio).toEqual({ masterVolumePercent: 25, muted: true });
    expect(loaded.settings.runtime.roundTime).toBe(45);
  });

  it('normalizes invalid JSON, types, ranges, paths, and unknown runtime state', async () => {
    const storage = memoryStorage({ [WEBMUGEN_SETTINGS_STORAGE_KEY]: '{invalid' });
    const invalidJson = await loadWebMugenSettings({ storage, fetcher: published({ runtime: { roundTime: 30 } }) });
    expect(invalidJson.settings.runtime.roundTime).toBe(30);

    const normalized = normalizeWebMugenSettings({
      audio: { masterVolumePercent: 200, muted: 'yes' },
      runtime: { roundTime: -4, frameIntervalMs: 0, stageArchivePath: 'https://evil.example/stage.zip' },
      content: { characterPath: '../secret.def' },
      life: 1,
      stateNo: 9000,
      projectiles: [{}],
    });
    expect(normalized.audio).toEqual(FALLBACK_WEBMUGEN_SETTINGS.audio);
    expect(normalized.runtime.roundTime).toBe(0);
    expect(normalized.runtime.frameIntervalMs).toBe(1);
    expect(normalized.runtime.stageArchivePath).toBe(FALLBACK_WEBMUGEN_SETTINGS.runtime.stageArchivePath);
    expect(normalized.content.characterPath).toBe(FALLBACK_WEBMUGEN_SETTINGS.content.characterPath);
    expect(normalized).not.toHaveProperty('life');
    expect(normalized).not.toHaveProperty('stateNo');
    expect(normalized).not.toHaveProperty('projectiles');
  });

  it('migrates legacy input and character keys once into the unified key', async () => {
    const input = structuredClone(DEFAULT_INPUT_CONFIG);
    input.players[0].keyboard.x = 'KeyQ';
    const storage = memoryStorage({
      [LEGACY_SETTINGS_KEYS.input]: JSON.stringify(input),
      [LEGACY_SETTINGS_KEYS.characterPath]: '/chars/KFM/KFM.def',
    });
    const loaded = await loadWebMugenSettings({ storage, fetcher: published({}) });
    expect(loaded.migratedLegacySettings).toBe(true);
    expect(loaded.settings.input.players[0].keyboard.x).toBe('KeyQ');
    expect(loaded.settings.content.characterPath).toBe('/chars/KFM/KFM.def');
    expect(storage.getItem(WEBMUGEN_SETTINGS_STORAGE_KEY)).toBeTruthy();
    expect(storage.getItem(LEGACY_SETTINGS_KEYS.input)).toBeNull();
    expect((await loadWebMugenSettings({ storage, fetcher: published({}) })).migratedLegacySettings).toBe(false);
  });

  it('normalizes versioned data and preserves a future migration entry point', () => {
    const migrated = migrateWebMugenSettings({ version: 99, runtime: { roundTime: 88 } });
    const normalized = normalizeWebMugenSettings(migrated);
    expect(normalized.version).toBe(1);
    expect(normalized.runtime.roundTime).toBe(88);
  });

  it('persists changes and resets to the latest published defaults', () => {
    const storage = memoryStorage();
    const changed = normalizeWebMugenSettings({ runtime: { roundTime: 10 } });
    expect(saveWebMugenSettings(changed, storage)).toBe(true);
    expect(JSON.parse(storage.getItem(WEBMUGEN_SETTINGS_STORAGE_KEY)!).runtime.roundTime).toBe(10);
    const publishedDefaults = normalizeWebMugenSettings({ runtime: { roundTime: 70 } });
    expect(resetWebMugenSettings(publishedDefaults, storage).runtime.roundTime).toBe(70);
    expect(storage.getItem(WEBMUGEN_SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it('persists the Catalog URL and Character, Stage, and LifeBar selections together', async () => {
    const storage = memoryStorage();
    saveWebMugenSettings(normalizeWebMugenSettings({ content: {
      catalogPath: '/content/alternate.json', characterId: 'hero', stageId: 'arena', lifeBarId: 'hud', characterPath: '/content/chars/hero.zip',
    } }), storage);
    const loaded = await loadWebMugenSettings({ storage, fetcher: published({}) });
    expect(loaded.settings.content).toMatchObject({
      catalogPath: '/content/alternate.json', characterId: 'hero', stageId: 'arena', lifeBarId: 'hud', characterPath: '/content/chars/hero.zip',
    });
  });

  it('keeps settings isolated per origin storage', () => {
    const localhost = memoryStorage();
    const publicSite = memoryStorage();
    saveWebMugenSettings(normalizeWebMugenSettings({ runtime: { roundTime: 10 } }), localhost);
    saveWebMugenSettings(normalizeWebMugenSettings({ runtime: { roundTime: 20 } }), publicSite);
    expect(JSON.parse(localhost.getItem(WEBMUGEN_SETTINGS_STORAGE_KEY)!).runtime.roundTime).toBe(10);
    expect(JSON.parse(publicSite.getItem(WEBMUGEN_SETTINGS_STORAGE_KEY)!).runtime.roundTime).toBe(20);
  });

  it('publishes only a normalized versioned settings object', async () => {
    let request: { input: string; init: RequestInit } | undefined;
    await publishWebMugenDefaults(normalizeWebMugenSettings({ runtime: { roundTime: 42 } }), async (input, init) => {
      request = { input, init };
      return { ok: true, status: 200, text: async () => '' };
    });
    expect(request?.input).toBe('/__webmugen/default-settings');
    const body = JSON.parse(String(request?.init.body));
    expect(body.version).toBe(1);
    expect(body.runtime.roundTime).toBe(42);
    expect(body).not.toHaveProperty('life');
  });

  it('ignores development-only saved settings in public mode', () => {
    const published = normalizeWebMugenSettings({
      content: { characterPath: '/chars/T-H-M-A.zip' },
      runtime: { stageArchivePath: '/stages/published.zip' },
    });
    const saved = normalizeWebMugenSettings({
      content: { characterPath: '/chars/KFM/KFM.def' },
      runtime: {
        stageArchivePath: '/stages/private.zip',
        humanLogEnabled: true,
        aiLogEnabled: true,
        collisionBoxesVisible: true,
        stateHistoryVisible: true,
        hitDiagnostics: true,
      },
    }, published);
    const publicSettings = applyFeaturePolicyToSettings(saved, published, createFeatureFlags('public'));
    expect(publicSettings.content).toEqual({
      ...saved.content,
      catalogPath: published.content.catalogPath,
    });
    expect(publicSettings.runtime.stageArchivePath).toBe('/stages/published.zip');
    expect(publicSettings.runtime).toMatchObject({
      humanLogEnabled: false,
      aiLogEnabled: false,
      collisionBoxesVisible: false,
      stateHistoryVisible: false,
      hitDiagnostics: false,
    });
    expect(applyFeaturePolicyToSettings(saved, published, createFeatureFlags('development')).runtime.aiLogEnabled).toBe(true);
  });

  it('resolves character and stage selections only through typed catalog entries', () => {
    const catalog = {
      version: 1 as const,
      rejectedEntries: 0,
      totalEntries: 3,
      issues: [],
      entries: [
        { id: 'hero', name: 'Hero', kind: 'character' as const, engine: 'winmugen' as const, path: '/chars/hero.zip' },
        { id: 'arena', name: 'Arena', kind: 'stage' as const, engine: 'winmugen' as const, path: '/stages/arena.zip' },
        { id: 'fresh-hud', name: 'Fresh HUD', kind: 'lifebar' as const, engine: 'webmugen' as const, path: 'builtin:lifebar:fresh-hud' },
      ],
    };
    const resolved = applyCatalogSelectionToSettings(normalizeWebMugenSettings({
      content: { characterId: 'unknown', stageId: 'unknown' },
    }), catalog);
    expect(resolved.content).toMatchObject({ characterId: 'hero', stageId: 'arena', lifeBarId: 'fresh-hud', characterPath: '/chars/hero.zip' });
    expect(resolved.runtime).toMatchObject({ stageTheme: 'external', stageArchivePath: '/stages/arena.zip', hudTheme: 'fresh' });
  });

  it('preserves same-origin paths resolved relative to /content/catalog.json', () => {
    const catalog = {
      version: 1 as const, rejectedEntries: 0, totalEntries: 2, issues: [],
      entries: [
        { id: 'hero', name: 'Hero', kind: 'character' as const, engine: 'winmugen' as const, path: '/content/chars/hero.zip' },
        { id: 'arena', name: 'Arena', kind: 'stage' as const, engine: 'winmugen' as const, path: '/content/stages/arena.zip' },
      ],
    };
    const resolved = applyCatalogSelectionToSettings(normalizeWebMugenSettings({ content: { characterId: 'hero', stageId: 'arena' } }), catalog);
    expect(resolved.content.characterPath).toBe('/content/chars/hero.zip');
    expect(resolved.runtime.stageArchivePath).toBe('/content/stages/arena.zip');
  });

  it.each(['fresh-clasic', 'cyber-clasic'] as const)('selects the %s native stage presentation from its catalog ID', (id) => {
    const catalog = {
      version: 1 as const,
      rejectedEntries: 0,
      totalEntries: 2,
      issues: [],
      entries: [
        { id: 'hero', name: 'Hero', kind: 'character' as const, engine: 'winmugen' as const, path: '/chars/hero.zip' },
        { id, name: id, kind: 'stage' as const, engine: 'webmugen' as const, path: `builtin:stage:${id}` },
      ],
    };
    const resolved = applyCatalogSelectionToSettings(normalizeWebMugenSettings({
      content: { characterId: 'hero', stageId: id },
    }), catalog);
    expect(resolved.runtime.stageTheme).toBe(id);
  });

  it('keeps legacy appearance controls and persisted content IDs aligned', () => {
    const synchronized = synchronizeContentIdsFromRuntime(normalizeWebMugenSettings({
      runtime: { stageTheme: 'fresh-clasic', hudTheme: 'fresh' },
      content: { stageId: 'cyber', lifeBarId: 'default-cyber' },
    }));
    expect(synchronized.content).toMatchObject({ stageId: 'fresh-clasic', lifeBarId: 'fresh-hud' });
  });
});

function published(value: unknown) {
  return async () => ({ ok: true, json: async () => value });
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
