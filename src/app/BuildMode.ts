export type WebMugenBuildMode = 'development' | 'public';

export type WebMugenFeatureFlags = {
  buildMode: WebMugenBuildMode;
  characterFiles: boolean;
  characterEditor: boolean;
  characterLoader: boolean;
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
    characterLoader: development,
    catalogManagement: development,
    catalogGenerator: development,
    stageEditor: development,
    publishDefaultsButton: development,
    runtimeDebug: development,
    cnsTrace: development,
    detailedLogs: development,
    hitboxDebug: development,
    inputHistoryDebug: development,
    compatibilityMatrix: development,
  };
}

export const WEBMUGEN_BUILD_MODE = resolveBuildMode(import.meta.env.VITE_WEBMUGEN_MODE, {
  dev: import.meta.env.DEV,
  prod: import.meta.env.PROD,
});

export const WEBMUGEN_FEATURES = createFeatureFlags(WEBMUGEN_BUILD_MODE);
