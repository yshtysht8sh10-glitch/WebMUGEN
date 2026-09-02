import { describe, expect, it } from 'vitest';
import type { ContentCatalog } from './ContentCatalog';
import { FALLBACK_WEBMUGEN_SETTINGS, normalizeWebMugenSettings } from './WebMugenSettings';
import {
  applyUrlContentOverrides,
  applyUrlContentSelection,
  createUrlContentSelectionUrl,
  getUrlContentOverrides,
} from './UrlContentSelection';

const catalog: ContentCatalog = { version: 1, totalEntries: 4, rejectedEntries: 0, issues: [], entries: [
  { id: 'saved-char', name: 'Saved', kind: 'character', engine: 'winmugen', path: '/chars/saved.def' },
  { id: 'url char', name: 'URL', kind: 'character', engine: 'winmugen', path: '/chars/url.zip', visibility: 'unlisted' },
  { id: 'saved-stage', name: 'Saved stage', kind: 'stage', engine: 'webmugen', path: 'builtin:stage:fresh' },
  { id: 'url-stage', name: 'URL stage', kind: 'stage', engine: 'winmugen', path: '/stages/url.zip', visibility: 'unlisted' },
] };

const saved = normalizeWebMugenSettings({
  ...FALLBACK_WEBMUGEN_SETTINGS,
  content: { ...FALLBACK_WEBMUGEN_SETTINGS.content, characterId: 'saved-char', stageId: 'saved-stage' },
});

describe('URL content selection', () => {
  it('generates the existing character and stage query format from Catalog IDs', () => {
    expect(createUrlContentSelectionUrl(
      { origin: 'https://example.com', pathname: '/' },
      { characterId: 'itoko', stageId: 'fresh-clasic' },
    )).toBe('https://example.com/?character=itoko&stage=fresh-clasic');
  });

  it('encodes Catalog IDs without changing the decoded selection', () => {
    const url = createUrlContentSelectionUrl(
      { origin: 'https://example.com', pathname: '/' },
      { characterId: 'url char', stageId: 'url-stage' },
    );
    expect(url).toBe('https://example.com/?character=url+char&stage=url-stage');
    const result = applyUrlContentSelection(saved, catalog, new URL(url).search);
    expect(result.settings.content).toMatchObject({ characterId: 'url char', stageId: 'url-stage' });
  });

  it('preserves root and subdirectory deployment pathnames', () => {
    const selection = { characterId: 'itoko', stageId: 'fresh-clasic' };
    expect(createUrlContentSelectionUrl({ origin: 'https://example.com', pathname: '/' }, selection))
      .toBe('https://example.com/?character=itoko&stage=fresh-clasic');
    expect(createUrlContentSelectionUrl({ origin: 'https://example.com', pathname: '/WebMUGEN/' }, selection))
      .toBe('https://example.com/WebMUGEN/?character=itoko&stage=fresh-clasic');
  });

  it('keeps settings when no URL override is present', () => {
    const result = applyUrlContentSelection(saved, catalog, '');
    expect(result.settings.content).toMatchObject({ characterId: 'saved-char', stageId: 'saved-stage' });
    expect(result.source).toEqual({ character: 'settings', stage: 'settings' });
  });

  it('overrides only specified IDs and accepts URL encoding', () => {
    const result = applyUrlContentSelection(saved, catalog, '?character=url%20char');
    expect(result.settings.content).toMatchObject({ characterId: 'url char', stageId: 'saved-stage' });
    expect(result.source).toEqual({ character: 'url', stage: 'settings' });
  });

  it('can override both selected content types', () => {
    const result = applyUrlContentSelection(saved, catalog, '?character=url%20char&stage=url-stage');
    expect(result.settings.content).toMatchObject({ characterId: 'url char', stageId: 'url-stage' });
    expect(result.settings.runtime).toMatchObject({ stageTheme: 'external', stageArchivePath: '/stages/url.zip' });
  });

  it('does not retain an unlisted saved selection without an explicit URL', () => {
    const unlistedSaved = normalizeWebMugenSettings({
      ...saved,
      content: { ...saved.content, characterId: 'url char', stageId: 'url-stage' },
    }, saved);
    const result = applyUrlContentSelection(unlistedSaved, catalog, '');
    expect(result.settings.content).toMatchObject({ characterId: 'saved-char', stageId: 'saved-stage' });
  });

  it.each([
    ['unknown ID', '?character=missing'],
    ['wrong kind', '?character=url-stage'],
    ['empty ID', '?character='],
    ['duplicate query', '?character=url%20char&character=saved-char'],
    ['overlong ID', `?stage=${'a'.repeat(65)}`],
  ])('falls back to settings for %s', (_label, search) => {
    const result = applyUrlContentSelection(saved, catalog, search);
    expect(result.settings.content.characterId).toBe('saved-char');
    expect(result.settings.content.stageId).toBe('saved-stage');
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('has no storage side effect', () => {
    const before = JSON.stringify(saved);
    applyUrlContentSelection(saved, catalog, '?stage=url-stage');
    expect(JSON.stringify(saved)).toBe(before);
  });

  it('reapplies session URL content over later persisted setting changes', () => {
    const selected = applyUrlContentSelection(saved, catalog, '?character=url%20char&stage=url-stage');
    const overrides = getUrlContentOverrides(selected);
    const changed = normalizeWebMugenSettings({
      ...saved,
      audio: { ...saved.audio, muted: !saved.audio.muted },
    }, saved);
    const live = applyUrlContentOverrides(changed, catalog, overrides);

    expect(changed.content).toMatchObject({ characterId: 'saved-char', stageId: 'saved-stage' });
    expect(live.content).toMatchObject({ characterId: 'url char', stageId: 'url-stage' });
    expect(live.audio.muted).toBe(!saved.audio.muted);
  });
});
