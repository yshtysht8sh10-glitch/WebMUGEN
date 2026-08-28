import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ContentCatalog } from '../catalog/ContentCatalogTypes';
import { CatalogGeneratorPanel } from './CatalogGeneratorPanel';

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
    expect(html).toContain('class="catalog-apply-button"');
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
});
