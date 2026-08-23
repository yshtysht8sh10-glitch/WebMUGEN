import { findCatalogEntry, type ContentCatalog, type ContentKind } from './ContentCatalog';
import { applyCatalogSelectionToSettings, type WebMugenSettings } from './WebMugenSettings';

export type ContentSelectionSource = 'url' | 'settings';

export type UrlContentSelectionResult = {
  settings: WebMugenSettings;
  source: { character: ContentSelectionSource; stage: ContentSelectionSource };
  diagnostics: string[];
};

export type UrlContentOverrides = Partial<Pick<WebMugenSettings['content'], 'characterId' | 'stageId'>>;

export type UrlContentSelectionBase = Pick<Location, 'origin' | 'pathname'>;

const URL_CONTENT_QUERY_KEYS = {
  character: 'character',
  stage: 'stage',
} as const;

export function createUrlContentSelectionUrl(
  base: UrlContentSelectionBase,
  selection: Pick<WebMugenSettings['content'], 'characterId' | 'stageId'>,
): string {
  const url = new URL(base.pathname || '/', base.origin);
  url.search = '';
  url.hash = '';
  url.searchParams.set(URL_CONTENT_QUERY_KEYS.character, selection.characterId);
  url.searchParams.set(URL_CONTENT_QUERY_KEYS.stage, selection.stageId);
  return url.href;
}

export function getUrlContentOverrides(result: UrlContentSelectionResult): UrlContentOverrides {
  return {
    ...(result.source.character === 'url' ? { characterId: result.settings.content.characterId } : {}),
    ...(result.source.stage === 'url' ? { stageId: result.settings.content.stageId } : {}),
  };
}

export function applyUrlContentOverrides(
  settings: WebMugenSettings,
  catalog: ContentCatalog,
  overrides: UrlContentOverrides,
): WebMugenSettings {
  if (overrides.characterId === undefined && overrides.stageId === undefined) return settings;
  return applyCatalogSelectionToSettings({
    ...settings,
    content: { ...settings.content, ...overrides },
  }, catalog);
}

export function applyUrlContentSelection(
  settings: WebMugenSettings,
  catalog: ContentCatalog,
  search: string,
): UrlContentSelectionResult {
  let query: URLSearchParams;
  try {
    query = new URLSearchParams(search);
  } catch {
    return { settings, source: { character: 'settings', stage: 'settings' }, diagnostics: ['query: parse failed'] };
  }
  const diagnostics: string[] = [];
  const character = readAllowedId(query, URL_CONTENT_QUERY_KEYS.character, 'character', catalog, diagnostics);
  const stage = readAllowedId(query, URL_CONTENT_QUERY_KEYS.stage, 'stage', catalog, diagnostics);
  const selected = applyCatalogSelectionToSettings({
    ...settings,
    content: {
      ...settings.content,
      characterId: character ?? settings.content.characterId,
      stageId: stage ?? settings.content.stageId,
    },
  }, catalog);
  return {
    settings: selected,
    source: { character: character ? 'url' : 'settings', stage: stage ? 'url' : 'settings' },
    diagnostics,
  };
}

function readAllowedId(
  query: URLSearchParams,
  key: string,
  kind: ContentKind,
  catalog: ContentCatalog,
  diagnostics: string[],
): string | undefined {
  const values = query.getAll(key);
  if (values.length === 0) return undefined;
  if (values.length !== 1) {
    diagnostics.push(`${key}: duplicate query rejected`);
    return undefined;
  }
  const id = values[0].trim();
  if (!id || id.length > 64) {
    diagnostics.push(`${key}: empty or overlong ID rejected`);
    return undefined;
  }
  if (!findCatalogEntry(catalog, kind, id)) {
    diagnostics.push(`${key}: unknown or wrong-kind ID rejected`);
    return undefined;
  }
  diagnostics.push(`${key}: ${id} selected from URL`);
  return id;
}
