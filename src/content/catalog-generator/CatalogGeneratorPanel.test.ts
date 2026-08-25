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
  it('shows only local folder and write controls in local mode', () => {
    const html = renderToStaticMarkup(createElement(CatalogGeneratorPanel, { catalog, initialMode: 'local' }));

    expect(html).toContain('aria-pressed="true" class="active" type="button">Local</button>');
    expect(html).toContain('Choose folder');
    expect(html).toContain('Catalog output folder');
    expect(html).toContain('Write catalog.json');
    expect(html).not.toContain('Direct file path');
  });

  it('shows only published server paths and download controls in server mode', () => {
    const html = renderToStaticMarkup(createElement(CatalogGeneratorPanel, { catalog, initialMode: 'server' }));

    expect(html).toContain('aria-pressed="true" class="active" type="button">Server</button>');
    expect(html).toContain('Published URL base');
    expect(html).toContain('Direct file path');
    expect(html).toContain('Download catalog.json');
    expect(html).not.toContain('Choose folder');
    expect(html).not.toContain('Catalog output folder');
    expect(html).not.toContain('Write catalog.json');
  });
});
