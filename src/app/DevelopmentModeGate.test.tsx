import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DevelopmentModeGate } from './DevelopmentModeGate';

describe('DevelopmentModeGate', () => {
  it('shows only the Pass entry control before authorization', () => {
    const html = renderToStaticMarkup(createElement(DevelopmentModeGate, {
      active: false,
      canLock: false,
      defaultOpen: true,
      onUnlock: vi.fn(),
      onLock: vi.fn(),
    }));

    expect(html).toContain('Development Mode Pass');
    expect(html).toContain('type="password"');
    expect(html).not.toContain('DEVELOPMENT MODE</strong>');
  });

  it('shows the Development badge after authorization without rendering the Pass', () => {
    const html = renderToStaticMarkup(createElement(DevelopmentModeGate, {
      active: true,
      canLock: true,
      onUnlock: vi.fn(),
      onLock: vi.fn(),
    }));

    expect(html).toContain('DEVELOPMENT MODE</strong>');
    expect(html).toContain('>Exit</button>');
    expect(html).not.toContain('Development Mode Pass');
  });
});
