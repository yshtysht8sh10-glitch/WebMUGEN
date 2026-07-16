import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RUNTIME_SETTINGS,
  RUNTIME_SETTINGS_STORAGE_KEY,
  loadRuntimeSettings,
  normalizeRuntimeSettings,
  saveRuntimeSettings,
} from './RuntimeSettings';

describe('Issue #64 runtime settings persistence', () => {
  it('defaults missing and legacy settings to Power Infinite OFF', () => {
    expect(normalizeRuntimeSettings(undefined).infinitePower).toBe('off');
    expect(normalizeRuntimeSettings({ roundTime: 20, hitDiagnostics: false }).infinitePower).toBe('off');
    expect(normalizeRuntimeSettings({ infinitePower: 'invalid' }).infinitePower).toBe('off');
  });

  it.each(['off', 'p1', 'p2', 'both'] as const)('persists and reloads mode %s', (infinitePower) => {
    let stored: string | null = null;
    const storage = {
      getItem: (key: string) => key === RUNTIME_SETTINGS_STORAGE_KEY ? stored : null,
      setItem: (key: string, value: string) => {
        if (key === RUNTIME_SETTINGS_STORAGE_KEY) stored = value;
      },
    };
    saveRuntimeSettings({ ...DEFAULT_RUNTIME_SETTINGS, infinitePower }, storage);
    expect(loadRuntimeSettings(storage).infinitePower).toBe(infinitePower);
  });

  it('falls back safely when storage is inaccessible', () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); },
    };
    expect(loadRuntimeSettings(broken)).toEqual(DEFAULT_RUNTIME_SETTINGS);
    expect(() => saveRuntimeSettings({ ...DEFAULT_RUNTIME_SETTINGS, infinitePower: 'both' }, broken)).not.toThrow();
  });
});
