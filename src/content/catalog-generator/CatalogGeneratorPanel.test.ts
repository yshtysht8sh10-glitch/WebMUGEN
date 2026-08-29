import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ContentCatalog } from '../catalog/ContentCatalogTypes';
import { CatalogGeneratorPanel, catalogApplyButtonFeedback, normalizeServerPublicBase } from './CatalogGeneratorPanel';

const catalog: ContentCatalog = {
  version: 1,
  totalEntries: 0,
  rejectedEntries: 0,
  issues: [],
  entries: [],
};

describe('CatalogGeneratorPanel', () => {
  it('groups local Catalog draft and output controls in local mode', () => {
    const html = renderToStaticMarkup(createElement(CatalogGeneratorPanel, { catalog, initialMode: 'local' }));

    expect(html).toContain('aria-pressed="true" class="active" type="button">Local</button>');
    expect(html).toContain('Choose folder');
    expect(html).toContain('Catalog output');
    expect(html).toContain('Choose output folder');
    expect(html).toContain('Import selected external content into draft');
    expect(html).toContain('Add built-in content to draft');
    expect(html).toContain('Edit draft as JSON');
    expect(html).toContain('Apply draft to catalog.json');
    expect(html).toContain('class="catalog-apply-button default"');
    expect(html).toContain('>Same as loaded Catalog</span>');
    expect(html).toContain('Download draft as catalog.json');
    expect(html).not.toContain('Direct file path');
  });

  it('shows authenticated save controls in development server mode', () => {
    const html = renderToStaticMarkup(createElement(CatalogGeneratorPanel, { catalog, initialMode: 'server', canWriteServer: true }));

    expect(html).toContain('aria-pressed="true" class="active" type="button">Server</button>');
    expect(html).toContain('Published URL base');
    expect(html).toContain('Direct file path');
    expect(html).toContain('Download draft as catalog.json');
    expect(html).toContain('Catalog API Token');
    expect(html).toContain('Apply draft to catalog.json');
    expect(html).toContain('Import selected external content into draft');
    expect(html).toContain('Add built-in content to draft');
    expect(html).not.toContain('Choose folder');
    expect(html).not.toContain('Choose output folder');
  });

  it('uses the Development session without exposing a second token field', () => {
    const html = renderToStaticMarkup(createElement(CatalogGeneratorPanel, {
      catalog,
      initialMode: 'server',
      canWriteServer: true,
      serverCredential: 'wmd1.memory-only-session.signature',
    }));

    expect(html).toContain('Development Mode authenticated');
    expect(html).toContain('Apply draft to catalog.json');
    expect(html).not.toContain('Catalog API Token');
    expect(html).toContain('short-lived Development session');
    expect(html).not.toContain('memory-only-session');
  });

  it('does not expose server write controls when the build policy disables them', () => {
    const html = renderToStaticMarkup(createElement(CatalogGeneratorPanel, { catalog, initialMode: 'server', canWriteServer: false }));

    expect(html).toContain('Download draft as catalog.json');
    expect(html).not.toContain('Catalog API Token');
    expect(html).not.toContain('Apply draft to catalog.json');
  });

  it('shows progress, success, and failure directly on the apply button', () => {
    const english = (value: string) => value;

    expect(catalogApplyButtonFeedback(true, 'server-saving', english)).toEqual({
      label: 'Applying...', tone: 'saving',
    });
    expect(catalogApplyButtonFeedback(false, 'server-saved', english)).toEqual({
      label: '✓ Applied to catalog.json', tone: 'saved',
    });
    expect(catalogApplyButtonFeedback(true, 'server-failed', english)).toEqual({
      label: 'Apply failed — check the message below', tone: 'error',
    });
    expect(catalogApplyButtonFeedback(true, 'idle', english)).toEqual({
      label: 'Apply draft to catalog.json', tone: 'default',
    });
  });

  it('matches a server scan base regardless of a trailing slash', () => {
    expect(normalizeServerPublicBase(' /DotoEita/16_proxy_release/storage/data/ '))
      .toBe('/DotoEita/16_proxy_release/storage/data');
  });
});
