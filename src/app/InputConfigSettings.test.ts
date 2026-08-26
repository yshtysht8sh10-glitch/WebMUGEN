import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_INPUT_CONFIG } from './BrowserInput';
import { InputConfigPanel } from './WebMugenApp';

describe('input settings UI', () => {
  it('shows per-player controller selection and explicit Axis/Button mappings without a duplicate summary', () => {
    const html = renderToStaticMarkup(createElement(InputConfigPanel, {
      config: DEFAULT_INPUT_CONFIG,
      onChange: vi.fn(),
    }));

    expect(html).toContain('aria-label="P1 controller"');
    expect(html).toContain('aria-label="P2 controller"');
    expect(html).toContain('Keyboard');
    expect(html).toContain('Axis 0 − / Button');
    expect(html).toContain('Axis 0 + / Button');
    expect(html).toContain('Axis 1 − / Button');
    expect(html).toContain('Axis 1 + / Button');
    expect(html).toContain('Button');
    expect(html).not.toContain('Control Summary');
    expect(html).not.toContain('操作一覧');
  });
});
