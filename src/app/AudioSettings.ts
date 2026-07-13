export const AUDIO_SETTINGS_STORAGE_KEY = 'webmugen.audioSettings.v1';
export const DEFAULT_MASTER_VOLUME_PERCENT = 50;

export type AudioSettings = {
  masterVolumePercent: number;
  muted: boolean;
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolumePercent: DEFAULT_MASTER_VOLUME_PERCENT,
  muted: false,
};

type AudioSettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function normalizeAudioSettings(value: unknown): AudioSettings {
  const source = value && typeof value === 'object' ? value as Partial<AudioSettings> : {};
  const volume = source.masterVolumePercent;
  return {
    masterVolumePercent: typeof volume === 'number' && Number.isFinite(volume) && volume >= 0 && volume <= 100
      ? Math.round(volume)
      : DEFAULT_MASTER_VOLUME_PERCENT,
    muted: typeof source.muted === 'boolean' ? source.muted : false,
  };
}

export function loadAudioSettings(storage: AudioSettingsStorage | null = getAudioSettingsStorage()): AudioSettings {
  if (!storage) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const raw = storage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    return raw ? normalizeAudioSettings(JSON.parse(raw)) : { ...DEFAULT_AUDIO_SETTINGS };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(
  settings: AudioSettings,
  storage: AudioSettingsStorage | null = getAudioSettingsStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAudioSettings(settings)));
  } catch {
    // Storage can be unavailable or quota-blocked without disabling audio controls.
  }
}

export function adjustMasterVolumeFromKey(current: number, key: string): number | null {
  const delta = key === 'ArrowRight' || key === 'ArrowUp'
    ? 1
    : key === 'ArrowLeft' || key === 'ArrowDown'
      ? -1
      : key === 'PageUp'
        ? 10
        : key === 'PageDown'
          ? -10
          : null;
  if (key === 'Home') return 0;
  if (key === 'End') return 100;
  return delta === null ? null : Math.min(100, Math.max(0, current + delta));
}

function getAudioSettingsStorage(): AudioSettingsStorage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
