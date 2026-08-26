import { DEFAULT_INPUT_CONFIG, type InputConfig, type PlayerInputMapping } from './BrowserInput';
import { DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings, type AudioSettings } from './AudioSettings';
import { DEFAULT_RUNTIME_SETTINGS, normalizeRuntimeSettings, type RuntimeSettings } from './RuntimeSettings';
import type { UiLanguage } from './UiLanguage';
import type { WebMugenFeatureFlags } from './BuildMode';
import { DEFAULT_CONTENT_CATALOG_PATH, resolveCatalogSelection, type ContentCatalog } from './ContentCatalog';
import { resolveApplicationAssetPath } from './ApplicationAssetPath';

export const WEBMUGEN_SETTINGS_VERSION = 1;
export const WEBMUGEN_SETTINGS_STORAGE_KEY = 'webmugen.settings.v1';
export const PUBLISHED_SETTINGS_PATH = resolveApplicationAssetPath('config/default-settings.json');
export const PUBLISH_SETTINGS_API_PATH = '/__webmugen/default-settings';

export const LEGACY_SETTINGS_KEYS = {
  input: 'webmugen.inputConfig.v1',
  characterPath: 'webmugen.characterPath.v1',
  runtime: 'webmugen.runtimeSettings.v1',
  audio: 'webmugen.audioSettings.v1',
  language: 'webmugen.uiLanguage.v1',
} as const;

export type WebMugenSettings = {
  version: typeof WEBMUGEN_SETTINGS_VERSION;
  audio: AudioSettings;
  runtime: RuntimeSettings;
  content: {
    catalogPath: string;
    characterId: string;
    stageId: string;
    lifeBarId: string;
    characterPath: string;
    paletteNo: number;
  };
  input: InputConfig;
  ui: {
    language: UiLanguage;
  };
};

export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;
export type SettingsFetch = (input: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export const FALLBACK_WEBMUGEN_SETTINGS: WebMugenSettings = {
  version: WEBMUGEN_SETTINGS_VERSION,
  audio: { ...DEFAULT_AUDIO_SETTINGS },
  runtime: { ...DEFAULT_RUNTIME_SETTINGS },
  content: {
    catalogPath: DEFAULT_CONTENT_CATALOG_PATH,
    characterId: 't-h-m-a',
    stageId: 'cyber',
    lifeBarId: 'default-cyber',
    characterPath: '/chars/T-H-M-A.zip',
    paletteNo: 1,
  },
  input: cloneInputConfig(DEFAULT_INPUT_CONFIG),
  ui: { language: 'en' },
};

export type LoadedWebMugenSettings = {
  settings: WebMugenSettings;
  publishedDefaults: WebMugenSettings;
  migratedLegacySettings: boolean;
  publishedDefaultsLoaded: boolean;
};

export async function loadWebMugenSettings(options: {
  storage?: SettingsStorage;
  fetcher?: SettingsFetch;
  browserLanguage?: string;
} = {}): Promise<LoadedWebMugenSettings> {
  const storage = options.storage ?? readLocalStorage();
  const fetcher = options.fetcher ?? readSettingsFetch();
  const browserLanguage = options.browserLanguage ?? readBrowserLanguage();
  const browserFallback = normalizeWebMugenSettings({
    ...FALLBACK_WEBMUGEN_SETTINGS,
    ui: { language: browserLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en' },
  });
  const publishedSource = await fetchPublishedSettings(fetcher);
  const publishedDefaults = normalizeWebMugenSettings(publishedSource, browserFallback);
  const saved = migrateWebMugenSettings(readJson(storage, WEBMUGEN_SETTINGS_STORAGE_KEY));
  const legacy = saved === undefined ? readLegacySettings(storage) : undefined;
  const settings = normalizeWebMugenSettings(saved ?? legacy, publishedDefaults);
  const migratedLegacySettings = saved === undefined && legacy !== undefined;
  if (migratedLegacySettings) {
    saveWebMugenSettings(settings, storage);
    removeLegacySettings(storage);
  }
  return {
    settings,
    publishedDefaults,
    migratedLegacySettings,
    publishedDefaultsLoaded: publishedSource !== undefined,
  };
}

export function normalizeWebMugenSettings(value: unknown, base: WebMugenSettings = FALLBACK_WEBMUGEN_SETTINGS): WebMugenSettings {
  const source = isRecord(value) ? value : {};
  const audioSource = isRecord(source.audio) ? source.audio : {};
  const runtimeSource = isRecord(source.runtime) ? source.runtime : {};
  const contentSource = isRecord(source.content) ? source.content : {};
  const uiSource = isRecord(source.ui) ? source.ui : {};
  const runtime = normalizeRuntimeSettings({ ...base.runtime, ...runtimeSource });
  runtime.stageArchivePath = normalizeContentPath(runtime.stageArchivePath, '/', base.runtime.stageArchivePath, ['.zip']);
  return {
    version: WEBMUGEN_SETTINGS_VERSION,
    audio: normalizeAudioSettings({ ...base.audio, ...audioSource }),
    runtime,
    content: {
      catalogPath: normalizeCatalogPath(contentSource.catalogPath, base.content.catalogPath),
      characterId: normalizeContentId(contentSource.characterId, base.content.characterId),
      stageId: normalizeContentId(contentSource.stageId, base.content.stageId),
      lifeBarId: normalizeContentId(contentSource.lifeBarId, base.content.lifeBarId),
      characterPath: normalizeContentPath(contentSource.characterPath, '/', base.content.characterPath, ['.def', '.zip']),
      paletteNo: normalizePaletteNo(contentSource.paletteNo, base.content.paletteNo),
    },
    input: normalizeInputConfig(source.input, base.input),
    ui: {
      language: uiSource.language === 'ja' || uiSource.language === 'en' ? uiSource.language : base.ui.language,
    },
  };
}

function normalizePaletteNo(value: unknown, fallback: number): number {
  const paletteNo = Number(value);
  return Number.isInteger(paletteNo) && paletteNo >= 1 && paletteNo <= 12 ? paletteNo : fallback;
}

export function migrateWebMugenSettings(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const version = Number(value.version);
  if (!Number.isInteger(version) || version <= WEBMUGEN_SETTINGS_VERSION) return value;
  // Future data keeps its known fields and is normalized back to the current safe schema.
  // Add explicit sequential migrations here before incrementing WEBMUGEN_SETTINGS_VERSION.
  return { ...value, version: WEBMUGEN_SETTINGS_VERSION };
}

export function applyFeaturePolicyToSettings(
  settings: WebMugenSettings,
  publishedDefaults: WebMugenSettings,
  features: WebMugenFeatureFlags,
): WebMugenSettings {
  const normalized = normalizeWebMugenSettings(settings, publishedDefaults);
  return normalizeWebMugenSettings({
    ...normalized,
    content: {
      ...normalized.content,
      catalogPath: features.catalogManagement ? normalized.content.catalogPath : publishedDefaults.content.catalogPath,
    },
    runtime: {
      ...normalized.runtime,
      stageArchivePath: features.stageEditor ? normalized.runtime.stageArchivePath : publishedDefaults.runtime.stageArchivePath,
      hitDiagnostics: features.detailedLogs ? normalized.runtime.hitDiagnostics : false,
      humanLogEnabled: features.detailedLogs ? normalized.runtime.humanLogEnabled : false,
      aiLogEnabled: features.detailedLogs ? normalized.runtime.aiLogEnabled : false,
      collisionBoxesVisible: features.hitboxDebug ? normalized.runtime.collisionBoxesVisible : false,
      stateHistoryVisible: features.inputHistoryDebug ? normalized.runtime.stateHistoryVisible : false,
    },
  }, publishedDefaults);
}

export function applyCatalogSelectionToSettings(settings: WebMugenSettings, catalog: ContentCatalog): WebMugenSettings {
  const { character, stage, lifeBar } = resolveCatalogSelection(catalog, settings.content);
  const next = normalizeWebMugenSettings({
    ...settings,
    content: {
      ...settings.content,
      characterId: character?.id ?? settings.content.characterId,
      stageId: stage?.id ?? settings.content.stageId,
      lifeBarId: lifeBar?.id ?? settings.content.lifeBarId,
      characterPath: character?.path ?? settings.content.characterPath,
    },
  }, settings);
  if (stage?.engine === 'webmugen' && stage.path.startsWith('builtin:stage:')) {
    const theme = stage.path.slice('builtin:stage:'.length);
    if (theme === 'fresh' || theme === 'cyber' || theme === 'fresh-clasic' || theme === 'cyber-clasic') {
      next.runtime = { ...next.runtime, stageTheme: theme };
    }
  } else if (stage?.engine === 'winmugen') {
    next.runtime = { ...next.runtime, stageTheme: 'external', stageArchivePath: stage.path };
  }
  if (lifeBar?.engine === 'webmugen' && lifeBar.path.startsWith('builtin:lifebar:')) {
    next.runtime = { ...next.runtime, hudTheme: lifeBar.id === 'fresh-hud' ? 'fresh' : 'cyber' };
  }
  return next;
}

export function synchronizeContentIdsFromRuntime(settings: WebMugenSettings): WebMugenSettings {
  return normalizeWebMugenSettings({
    ...settings,
    content: {
      ...settings.content,
      stageId: settings.runtime.stageTheme === 'external' ? settings.content.stageId : settings.runtime.stageTheme,
      lifeBarId: settings.runtime.hudTheme === 'fresh' ? 'fresh-hud' : 'default-cyber',
    },
  }, settings);
}

export function saveWebMugenSettings(settings: WebMugenSettings, storage: SettingsStorage | undefined = readLocalStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(WEBMUGEN_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeWebMugenSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

export function resetWebMugenSettings(publishedDefaults: WebMugenSettings, storage: SettingsStorage | undefined = readLocalStorage()): WebMugenSettings {
  try {
    storage?.removeItem?.(WEBMUGEN_SETTINGS_STORAGE_KEY);
  } catch {
    // Reset still updates the live application when storage is blocked.
  }
  return normalizeWebMugenSettings(publishedDefaults);
}

export async function publishWebMugenDefaults(
  settings: WebMugenSettings,
  fetcher: (input: string, init: RequestInit) => Promise<{ ok: boolean; status: number; text(): Promise<string> }> = fetch,
): Promise<void> {
  const response = await fetcher(PUBLISH_SETTINGS_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizeWebMugenSettings(settings)),
  });
  if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
}

function readLegacySettings(storage: SettingsStorage | undefined): unknown {
  if (!storage) return undefined;
  const input = readJson(storage, LEGACY_SETTINGS_KEYS.input);
  const runtime = readJson(storage, LEGACY_SETTINGS_KEYS.runtime);
  const audio = readJson(storage, LEGACY_SETTINGS_KEYS.audio);
  const characterPath = readString(storage, LEGACY_SETTINGS_KEYS.characterPath);
  const language = readString(storage, LEGACY_SETTINGS_KEYS.language);
  if (input === undefined && runtime === undefined && audio === undefined && characterPath === undefined && language === undefined) return undefined;
  return {
    version: WEBMUGEN_SETTINGS_VERSION,
    input,
    runtime,
    audio,
    content: {
      characterPath,
      characterId: typeof characterPath === 'string' && /kfm/i.test(characterPath) ? 'kfm' : 't-h-m-a',
    },
    ui: { language },
  };
}

function removeLegacySettings(storage: SettingsStorage | undefined): void {
  if (!storage?.removeItem) return;
  for (const key of Object.values(LEGACY_SETTINGS_KEYS)) {
    try {
      storage.removeItem(key);
    } catch {
      // A successful unified write is enough; stale keys are ignored thereafter.
    }
  }
}

async function fetchPublishedSettings(fetcher: SettingsFetch | undefined): Promise<unknown> {
  if (!fetcher) return undefined;
  try {
    const response = await fetcher(PUBLISHED_SETTINGS_PATH);
    return response.ok ? await response.json() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeContentPath(value: unknown, prefix: string, fallback: string, extensions: readonly string[]): string {
  if (typeof value !== 'string') return fallback;
  const path = value.trim().replace(/\\/g, '/');
  const lower = path.toLowerCase();
  if (!path.startsWith(prefix) || path.includes('..') || path.includes('://') || !extensions.some((extension) => lower.endsWith(extension))) return fallback;
  return path;
}

function normalizeCatalogPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const path = value.trim().replace(/\\/g, '/');
  if (!path.endsWith('.json') || path.includes('..') || path.includes('://')) return fallback;
  if (path.startsWith('/')) return path;
  try {
    return resolveApplicationAssetPath(path);
  } catch {
    return fallback;
  }
}

function normalizeContentId(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value) ? value : fallback;
}

function normalizeInputConfig(value: unknown, base: InputConfig): InputConfig {
  if (!isRecord(value) || !Array.isArray(value.players)) return cloneInputConfig(base);
  return {
    players: [
      normalizePlayerInputConfig(value.players[0], base.players[0]),
      normalizePlayerInputConfig(value.players[1], base.players[1]),
    ],
  };
}

function normalizePlayerInputConfig(value: unknown, fallback: PlayerInputMapping): PlayerInputMapping {
  if (!isRecord(value)) return clonePlayerInputConfig(fallback);
  const keyboard = isRecord(value.keyboard) ? value.keyboard : {};
  const gamepad = isRecord(value.gamepad) ? value.gamepad : {};
  const next = clonePlayerInputConfig(fallback);
  for (const action of Object.keys(next.keyboard) as Array<keyof PlayerInputMapping['keyboard']>) {
    if (typeof keyboard[action] === 'string' && keyboard[action]) next.keyboard[action] = keyboard[action];
  }
  for (const action of Object.keys(next.gamepad) as Array<keyof PlayerInputMapping['gamepad']>) {
    if (typeof gamepad[action] === 'number' && Number.isInteger(gamepad[action]) && gamepad[action] >= 0) next.gamepad[action] = gamepad[action];
  }
  if (isRecord(value.controller)) {
    if (value.controller.type === 'keyboard') {
      next.controller = { type: 'keyboard' };
    } else if (
      value.controller.type === 'gamepad'
      && typeof value.controller.index === 'number'
      && Number.isInteger(value.controller.index)
      && value.controller.index >= 0
    ) {
      next.controller = {
        type: 'gamepad',
        index: value.controller.index,
        id: typeof value.controller.id === 'string' ? value.controller.id : '',
        mapping: typeof value.controller.mapping === 'string' ? value.controller.mapping : '',
        ordinal: typeof value.controller.ordinal === 'number' && Number.isInteger(value.controller.ordinal) && value.controller.ordinal >= 0
          ? value.controller.ordinal
          : 0,
      };
    }
  }
  return next;
}

function cloneInputConfig(config: InputConfig): InputConfig {
  return { players: [clonePlayerInputConfig(config.players[0]), clonePlayerInputConfig(config.players[1])] };
}

function clonePlayerInputConfig(player: PlayerInputMapping): PlayerInputMapping {
  return { keyboard: { ...player.keyboard }, gamepad: { ...player.gamepad }, controller: { ...player.controller } };
}

function readJson(storage: SettingsStorage | undefined, key: string): unknown {
  const raw = readString(storage, key);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function readString(storage: SettingsStorage | undefined, key: string): string | undefined {
  if (!storage) return undefined;
  try {
    return storage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readLocalStorage(): SettingsStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function readSettingsFetch(): SettingsFetch | undefined {
  return typeof fetch === 'function' ? (input) => fetch(input) : undefined;
}

function readBrowserLanguage(): string {
  try {
    return typeof navigator === 'undefined' ? 'en' : navigator.language;
  } catch {
    return 'en';
  }
}
