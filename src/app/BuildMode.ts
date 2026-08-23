export type WebMugenBuildMode = 'development' | 'public';

export type WebMugenFeatureFlags = {
  buildMode: WebMugenBuildMode;
  characterFiles: boolean;
  characterEditor: boolean;
  catalogManagement: boolean;
  catalogGenerator: boolean;
  stageEditor: boolean;
  publishDefaultsButton: boolean;
  runtimeDebug: boolean;
  cnsTrace: boolean;
  detailedLogs: boolean;
  hitboxDebug: boolean;
  inputHistoryDebug: boolean;
  compatibilityMatrix: boolean;
  shareUrl: boolean;
};

export function resolveBuildMode(value: unknown, environment: { dev: boolean; prod: boolean }): WebMugenBuildMode {
  if (value === 'development' || value === 'public') return value;
  return environment.prod ? 'public' : environment.dev ? 'development' : 'public';
}

export function createFeatureFlags(buildMode: WebMugenBuildMode): WebMugenFeatureFlags {
  const development = buildMode === 'development';
  return {
    buildMode,
    characterFiles: true,
    characterEditor: development,
    catalogManagement: true,
    catalogGenerator: true,
    stageEditor: development,
    publishDefaultsButton: development,
    runtimeDebug: true,
    cnsTrace: true,
    detailedLogs: true,
    hitboxDebug: true,
    inputHistoryDebug: true,
    compatibilityMatrix: true,
    shareUrl: true,
  };
}

export const WEBMUGEN_BUILD_MODE = resolveBuildMode(import.meta.env.VITE_WEBMUGEN_MODE, {
  dev: import.meta.env.DEV,
  prod: import.meta.env.PROD,
});

export const WEBMUGEN_FEATURES = createFeatureFlags(WEBMUGEN_BUILD_MODE);
