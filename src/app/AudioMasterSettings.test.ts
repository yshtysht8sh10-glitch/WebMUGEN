import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AudioSettingsPanel } from './WebMugenApp';
import {
  AUDIO_SETTINGS_STORAGE_KEY,
  adjustMasterVolumeFromKey,
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  saveAudioSettings,
} from './AudioSettings';

describe('master audio settings UI', () => {
  it('renders a 0-100 keyboard range, current value, mute control, and explicit labels', () => {
    const html = renderToStaticMarkup(createElement(AudioSettingsPanel, {
      status: 'locked',
      muted: false,
      masterVolume: 50,
      diagnostic: 'audio=-',
      onUnlock: vi.fn(),
      onTest: vi.fn(),
      onStop: vi.fn(),
      onPanTest: vi.fn(),
      onMutedChange: vi.fn(),
      onMasterVolumeChange: vi.fn(),
    }));

    expect(html).toContain('Master volume: 50%');
    expect(html).toContain('type="range"');
    expect(html).toContain('min="0"');
    expect(html).toContain('max="100"');
    expect(html).toContain('step="1"');
    expect(html).toContain('aria-label="Master volume"');
    expect(html).toContain('aria-label="Mute all audio"');
  });

  it('saves and restores volume and mute', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    saveAudioSettings({ masterVolumePercent: 27, muted: true }, storage);
    expect(loadAudioSettings(storage)).toEqual({ masterVolumePercent: 27, muted: true });
    expect(JSON.parse(values.get(AUDIO_SETTINGS_STORAGE_KEY)!)).toEqual({ masterVolumePercent: 27, muted: true });
  });

  it('falls back safely for missing, malformed, old, out-of-range, and unavailable storage', () => {
    expect(loadAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(loadAudioSettings({ getItem: () => '{bad', setItem: vi.fn() })).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(loadAudioSettings({ getItem: () => JSON.stringify({ masterVolumePercent: '100', muted: 'yes' }), setItem: vi.fn() })).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(loadAudioSettings({ getItem: () => JSON.stringify({ masterVolumePercent: 101, muted: true }), setItem: vi.fn() })).toEqual({ masterVolumePercent: 50, muted: true });
    expect(() => saveAudioSettings(DEFAULT_AUDIO_SETTINGS, { getItem: vi.fn(), setItem: () => { throw new Error('quota'); } })).not.toThrow();
  });

  it('provides deterministic Arrow, Page, Home, and End keyboard steps', () => {
    expect(adjustMasterVolumeFromKey(50, 'ArrowRight')).toBe(51);
    expect(adjustMasterVolumeFromKey(50, 'ArrowDown')).toBe(49);
    expect(adjustMasterVolumeFromKey(95, 'PageUp')).toBe(100);
    expect(adjustMasterVolumeFromKey(5, 'PageDown')).toBe(0);
    expect(adjustMasterVolumeFromKey(50, 'Home')).toBe(0);
    expect(adjustMasterVolumeFromKey(50, 'End')).toBe(100);
    expect(adjustMasterVolumeFromKey(50, 'Enter')).toBeNull();
  });
});
