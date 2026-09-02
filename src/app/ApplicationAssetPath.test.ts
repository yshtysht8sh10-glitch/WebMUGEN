import { describe, expect, it } from 'vitest';
import { isSafeSameOriginAssetPath, isSafeSameOriginContentPath, resolveApplicationAssetPath } from './ApplicationAssetPath';

describe('resolveApplicationAssetPath', () => {
  it('keeps application assets inside root and subdirectory deployments', () => {
    expect(resolveApplicationAssetPath('content/catalog.json', 'https://example.test/index.html')).toBe('/content/catalog.json');
    expect(resolveApplicationAssetPath('content/catalog.json', 'https://example.test/DotoEita/50_WEBMUGEN/index.html?character=hero'))
      .toBe('/DotoEita/50_WEBMUGEN/content/catalog.json');
  });

  it.each(['/content/catalog.json', '../catalog.json', 'https://evil.test/catalog.json'])('rejects unsafe or non-relative input %s', (path) => {
    expect(() => resolveApplicationAssetPath(path, 'https://example.test/WebMUGEN/index.html')).toThrow('Unsafe application asset path');
  });
});

describe('isSafeSameOriginContentPath', () => {
  it('accepts root and subdirectory assets while rejecting traversal and remote URLs', () => {
    expect(isSafeSameOriginContentPath('/stages/demo.zip', ['stages'], ['.zip'])).toBe(true);
    expect(isSafeSameOriginContentPath('/DotoEita/50_WebMUGEN/stages/demo.zip', ['stages'], ['.zip'])).toBe(true);
    expect(isSafeSameOriginContentPath('/DotoEita/50_WebMUGEN/content/demo.zip', ['content'], ['.zip'])).toBe(true);
    expect(isSafeSameOriginContentPath('/stages/../private/demo.zip', ['stages'], ['.zip'])).toBe(false);
    expect(isSafeSameOriginContentPath('https://evil.test/stages/demo.zip', ['stages'], ['.zip'])).toBe(false);
  });
});

describe('isSafeSameOriginAssetPath', () => {
  it('accepts Catalog ZIPs outside the application directory while retaining same-origin path safety', () => {
    expect(isSafeSameOriginAssetPath('/DotoEita/16_proxy_release/storage/data/material-22-archive.zip', ['.zip'])).toBe(true);
    expect(isSafeSameOriginAssetPath('/DotoEita/16_proxy_release/storage/data/material-23-archive.ZIP', ['.zip'])).toBe(true);
    expect(isSafeSameOriginAssetPath('/DotoEita/16_proxy_release/storage/../private/stage.zip', ['.zip'])).toBe(false);
    expect(isSafeSameOriginAssetPath('//evil.test/stage.zip', ['.zip'])).toBe(false);
    expect(isSafeSameOriginAssetPath('https://evil.test/stage.zip', ['.zip'])).toBe(false);
    expect(isSafeSameOriginAssetPath('/DotoEita/16_proxy_release/storage/data/stage.def', ['.zip'])).toBe(false);
  });
});
