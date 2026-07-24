import { DEFAULT_ROUND_TIMER } from '../core/engine/RoundState';
import type { InfinitePowerMode } from '../core/power/InfinitePower';

export const DEFAULT_FRAME_INTERVAL_MS = 1000 / 60;
export const RUNTIME_SETTINGS_STORAGE_KEY = 'webmugen.runtimeSettings.v1';

export type RuntimeSettings = {
  roundTime: number;
  frameIntervalMs: number;
  hitDiagnostics: boolean;
  infinitePower: InfinitePowerMode;
  practiceMode: boolean;
  humanLogEnabled: boolean;
  aiLogEnabled: boolean;
  collisionBoxesVisible: boolean;
  stateHistoryVisible: boolean;
};

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
  roundTime: DEFAULT_ROUND_TIMER,
  frameIntervalMs: DEFAULT_FRAME_INTERVAL_MS,
  hitDiagnostics: true,
  infinitePower: 'off',
  practiceMode: false,
  humanLogEnabled: false,
  aiLogEnabled: false,
  collisionBoxesVisible: false,
  stateHistoryVisible: false,
};

export function loadRuntimeSettings(storage: Pick<Storage, 'getItem'> | undefined = readLocalStorage()): RuntimeSettings {
  if (!storage) return { ...DEFAULT_RUNTIME_SETTINGS };
  try {
    const raw = storage.getItem(RUNTIME_SETTINGS_STORAGE_KEY);
    return raw ? normalizeRuntimeSettings(JSON.parse(raw)) : { ...DEFAULT_RUNTIME_SETTINGS };
  } catch {
    return { ...DEFAULT_RUNTIME_SETTINGS };
  }
}

export function saveRuntimeSettings(
  settings: RuntimeSettings,
  storage: Pick<Storage, 'setItem'> | undefined = readLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(RUNTIME_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeRuntimeSettings(settings)));
  } catch {
    // A blocked or full storage backend must not disable the runtime setting.
  }
}

export function normalizeRuntimeSettings(value: unknown): RuntimeSettings {
  const source = value && typeof value === 'object' ? value as Partial<RuntimeSettings> : {};
  return {
    roundTime: clampInteger(source.roundTime, 0, 999, DEFAULT_RUNTIME_SETTINGS.roundTime),
    frameIntervalMs: clampNumber(source.frameIntervalMs, 1, 1000, DEFAULT_RUNTIME_SETTINGS.frameIntervalMs),
    hitDiagnostics: source.hitDiagnostics ?? DEFAULT_RUNTIME_SETTINGS.hitDiagnostics,
    infinitePower: normalizeInfinitePowerMode(source.infinitePower),
    practiceMode: normalizeBoolean(source.practiceMode),
    humanLogEnabled: normalizeBoolean(source.humanLogEnabled),
    aiLogEnabled: normalizeBoolean(source.aiLogEnabled),
    collisionBoxesVisible: normalizeBoolean(source.collisionBoxesVisible),
    stateHistoryVisible: normalizeBoolean(source.stateHistoryVisible),
  };
}

function normalizeBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

function normalizeInfinitePowerMode(value: unknown): InfinitePowerMode {
  return value === 'p1' || value === 'p2' || value === 'both' ? value : 'off';
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  return Math.trunc(clampNumber(value, min, max, fallback));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(min, Math.min(max, numberValue)) : fallback;
}

function readLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
