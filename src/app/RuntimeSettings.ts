import { DEFAULT_ROUND_TIMER } from '../core/engine/RoundState';
import type { InfinitePowerMode } from '../core/power/InfinitePower';
import type { ScreenSizeMode } from '../core/engine/ScreenSize';

export const DEFAULT_FRAME_INTERVAL_MS = 1000 / 60;
export const RUNTIME_SETTINGS_STORAGE_KEY = 'webmugen.runtimeSettings.v1';

export type HumanLogCaptureMode = 'all-frames' | 'trigger-changes' | 'state-transition' | 'controller-activated';
export type HudTheme = 'fresh' | 'cyber';
export type StageTheme = 'fresh' | 'cyber' | 'fresh-clasic' | 'cyber-clasic' | 'external';

export type RuntimeSettings = {
  roundTime: number;
  frameIntervalMs: number;
  hitDiagnostics: boolean;
  infinitePower: InfinitePowerMode;
  practiceMode: boolean;
  humanLogEnabled: boolean;
  humanLogCaptureMode: HumanLogCaptureMode;
  aiLogEnabled: boolean;
  collisionBoxesVisible: boolean;
  stateHistoryVisible: boolean;
  screenSizeMode: ScreenSizeMode;
  hudTheme: HudTheme;
  stageTheme: StageTheme;
  stageArchivePath: string;
};

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
  roundTime: DEFAULT_ROUND_TIMER,
  frameIntervalMs: DEFAULT_FRAME_INTERVAL_MS,
  hitDiagnostics: true,
  infinitePower: 'off',
  practiceMode: false,
  humanLogEnabled: false,
  humanLogCaptureMode: 'trigger-changes',
  aiLogEnabled: false,
  collisionBoxesVisible: false,
  stateHistoryVisible: false,
  screenSizeMode: 'winmugen-800x480',
  hudTheme: 'cyber',
  stageTheme: 'cyber',
  stageArchivePath: '/stages/material-22-archive.zip',
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
    humanLogCaptureMode: normalizeHumanLogCaptureMode(source.humanLogCaptureMode),
    aiLogEnabled: normalizeBoolean(source.aiLogEnabled),
    collisionBoxesVisible: normalizeBoolean(source.collisionBoxesVisible),
    stateHistoryVisible: normalizeBoolean(source.stateHistoryVisible),
    screenSizeMode: normalizeScreenSizeMode(source.screenSizeMode),
    hudTheme: source.hudTheme === 'cyber' ? 'cyber' : 'fresh',
    stageTheme: source.stageTheme === 'cyber'
      || source.stageTheme === 'fresh-clasic'
      || source.stageTheme === 'cyber-clasic'
      || source.stageTheme === 'external'
      ? source.stageTheme
      : 'fresh',
    stageArchivePath: normalizeStageArchivePath(source.stageArchivePath),
  };
}

function normalizeStageArchivePath(value: unknown): string {
  const path = typeof value === 'string' ? value.trim() : '';
  return path || DEFAULT_RUNTIME_SETTINGS.stageArchivePath;
}

function normalizeScreenSizeMode(value: unknown): ScreenSizeMode {
  return value === 'wide-960x540' || value === 'winmugen-classic-640x480'
    ? value
    : 'winmugen-800x480';
}

function normalizeHumanLogCaptureMode(value: unknown): HumanLogCaptureMode {
  return value === 'all-frames' || value === 'state-transition' || value === 'controller-activated'
    ? value
    : 'trigger-changes';
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
