import { findCatalogEntry, type ContentCatalog, type ContentKind } from './ContentCatalog';
import { applyCatalogSelectionToSettings, type WebMugenSettings } from './WebMugenSettings';

export type ContentSelectionSource = 'url' | 'settings';

export type UrlContentSelectionResult = {
  settings: WebMugenSettings;
  source: { character: ContentSelectionSource; stage: ContentSelectionSource };
  diagnostics: string[];
};

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
  const character = readAllowedId(query, 'character', 'character', catalog, diagnostics);
  const stage = readAllowedId(query, 'stage', 'stage', catalog, diagnostics);
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
