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

describe('Practice Mode setting', () => {
  it('defaults missing and invalid values to OFF', () => {
    expect(DEFAULT_RUNTIME_SETTINGS.practiceMode).toBe(false);
    expect(normalizeRuntimeSettings({ roundTime: 20 }).practiceMode).toBe(false);
    expect(normalizeRuntimeSettings({ practiceMode: 'true' }).practiceMode).toBe(false);
  });

  it('persists the checkbox value', () => {
    let stored: string | null = null;
    const storage = {
      getItem: () => stored,
      setItem: (_key: string, value: string) => { stored = value; },
    };

    saveRuntimeSettings({ ...DEFAULT_RUNTIME_SETTINGS, practiceMode: true }, storage);

    expect(loadRuntimeSettings(storage).practiceMode).toBe(true);
  });
});

describe('Issue #75 debug and logging settings', () => {
  it('defaults all four settings to OFF for new, legacy, and invalid data', () => {
    expect(DEFAULT_RUNTIME_SETTINGS).toMatchObject({
      humanLogEnabled: false,
      aiLogEnabled: false,
      collisionBoxesVisible: false,
      stateHistoryVisible: false,
    });
    expect(normalizeRuntimeSettings({ roundTime: 20 })).toMatchObject({
      humanLogEnabled: false,
      aiLogEnabled: false,
      collisionBoxesVisible: false,
      stateHistoryVisible: false,
    });
    expect(normalizeRuntimeSettings({
      humanLogEnabled: 1,
      aiLogEnabled: 'true',
      collisionBoxesVisible: null,
      stateHistoryVisible: {},
    })).toMatchObject({
      humanLogEnabled: false,
      aiLogEnabled: false,
      collisionBoxesVisible: false,
      stateHistoryVisible: false,
    });
  });

  it('persists the four settings independently', () => {
    let stored: string | null = null;
    const storage = {
      getItem: () => stored,
      setItem: (_key: string, value: string) => { stored = value; },
    };
    const expected = {
      ...DEFAULT_RUNTIME_SETTINGS,
      humanLogEnabled: true,
      aiLogEnabled: false,
      collisionBoxesVisible: true,
      stateHistoryVisible: false,
    };
    saveRuntimeSettings(expected, storage);
    expect(loadRuntimeSettings(storage)).toEqual(expected);
  });
});
