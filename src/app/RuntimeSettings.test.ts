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

describe('Screen size setting', () => {
  it('uses the 800x480 extended viewport for new, legacy, and invalid settings', () => {
    expect(DEFAULT_RUNTIME_SETTINGS.screenSizeMode).toBe('winmugen-800x480');
    expect(normalizeRuntimeSettings({ roundTime: 20 }).screenSizeMode).toBe('winmugen-800x480');
    expect(normalizeRuntimeSettings({ screenSizeMode: 'winmugen-320x240' }).screenSizeMode).toBe('winmugen-800x480');
    expect(normalizeRuntimeSettings({ screenSizeMode: 'winmugen-640x480' }).screenSizeMode).toBe('winmugen-800x480');
    expect(normalizeRuntimeSettings({ screenSizeMode: 'invalid' }).screenSizeMode).toBe('winmugen-800x480');
  });

  it('preserves the exact classic 640x480 alternative', () => {
    expect(normalizeRuntimeSettings({ screenSizeMode: 'winmugen-classic-640x480' }).screenSizeMode).toBe('winmugen-classic-640x480');
  });

  it('persists the wide screen alternative', () => {
    let stored: string | null = null;
    const storage = {
      getItem: () => stored,
      setItem: (_key: string, value: string) => { stored = value; },
    };
    saveRuntimeSettings({ ...DEFAULT_RUNTIME_SETTINGS, screenSizeMode: 'wide-960x540' }, storage);
    expect(loadRuntimeSettings(storage).screenSizeMode).toBe('wide-960x540');
  });
});

describe('HUD and stage appearance settings', () => {
  it('defaults themes independently and keeps the bundled stage ZIP path', () => {
    expect(normalizeRuntimeSettings({})).toMatchObject({
      hudTheme: 'fresh',
      stageTheme: 'fresh',
      stageArchivePath: '/stages/material-22-archive.zip',
    });
  });

  it('normalizes independent cyber HUD and external stage selection', () => {
    expect(normalizeRuntimeSettings({
      hudTheme: 'cyber',
      stageTheme: 'external',
      stageArchivePath: ' /stages/custom.zip ',
    })).toMatchObject({
      hudTheme: 'cyber',
      stageTheme: 'external',
      stageArchivePath: '/stages/custom.zip',
    });
  });
});

describe('Issue #75 debug and logging settings', () => {
  it('defaults all four settings to OFF for new, legacy, and invalid data', () => {
    expect(DEFAULT_RUNTIME_SETTINGS).toMatchObject({
      humanLogEnabled: false,
      humanLogCaptureMode: 'trigger-changes',
      aiLogEnabled: false,
      collisionBoxesVisible: false,
      stateHistoryVisible: false,
    });
    expect(normalizeRuntimeSettings({ roundTime: 20 })).toMatchObject({
      humanLogEnabled: false,
      humanLogCaptureMode: 'trigger-changes',
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

  it.each(['all-frames', 'trigger-changes', 'state-transition', 'controller-activated'] as const)('persists human log mode %s', (humanLogCaptureMode) => {
    let stored: string | null = null;
    const storage = {
      getItem: () => stored,
      setItem: (_key: string, value: string) => { stored = value; },
    };
    saveRuntimeSettings({ ...DEFAULT_RUNTIME_SETTINGS, humanLogCaptureMode }, storage);
    expect(loadRuntimeSettings(storage).humanLogCaptureMode).toBe(humanLogCaptureMode);
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
