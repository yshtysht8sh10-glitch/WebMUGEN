import { describe, expect, it } from 'vitest';
import { createFeatureFlags, resolveBuildMode } from './BuildMode';

describe('WebMUGEN build mode', () => {
  it('honors an explicit mode independently of Vite dev/prod', () => {
    expect(resolveBuildMode('public', { dev: true, prod: false })).toBe('public');
    expect(resolveBuildMode('development', { dev: false, prod: true })).toBe('development');
  });

  it('fails closed for production, invalid, and unknown environments', () => {
    expect(resolveBuildMode(undefined, { dev: false, prod: true })).toBe('public');
    expect(resolveBuildMode('invalid', { dev: false, prod: false })).toBe('public');
    expect(resolveBuildMode(undefined, { dev: true, prod: false })).toBe('development');
  });

  it('derives a consistent feature set from one mode', () => {
    expect(createFeatureFlags('public')).toMatchObject({
      buildMode: 'public',
      characterFiles: true,
      characterEditor: false,
      catalogManagement: true,
      catalogGenerator: true,
      catalogServerWriter: false,
      publishDefaultsButton: false,
      runtimeDebug: true,
      cnsTrace: true,
      detailedLogs: true,
      hitboxDebug: true,
      inputHistoryDebug: true,
      compatibilityMatrix: true,
      shareUrl: true,
    });
    expect(createFeatureFlags('development')).toMatchObject({
      characterFiles: true, characterEditor: true, catalogManagement: true, catalogGenerator: true, catalogServerWriter: true, publishDefaultsButton: true,
      shareUrl: true,
    });
  });
});
