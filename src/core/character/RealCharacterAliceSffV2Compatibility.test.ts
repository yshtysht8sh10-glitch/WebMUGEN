import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyZipBytes } from '../../content/catalog-generator/CatalogContentClassifier';
import { loadAppCharacter, readCharacterRuntimeMetadata } from '../../app/AppCharacterLoader';

class FakeImageData { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} }
(globalThis as unknown as { ImageData: typeof ImageData }).ImageData = FakeImageData as unknown as typeof ImageData;

const ALICE_ZIP = 'D:/01_趣味/093_hp/22_ドット絵板2026/16_proxy_release_202608242025/storage/data/material-5-archive.zip';

describe.skipIf(!existsSync(ALICE_ZIP))('Alice Liddell SFF v2 compatibility', () => {
  it('loads the real archive through the application route without sample fallback', async () => {
    const bytes = new Uint8Array(readFileSync(ALICE_ZIP));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: RequestInfo | URL) => (
      String(path) === '/chars/material-5-archive.zip'
        ? new Response(bytes, { status: 200 })
        : new Response('missing', { status: 404 })
    )) as typeof fetch;
    try {
      const result = await loadAppCharacter('/chars/material-5-archive.zip');
      expect(result.source).toBe('def'); expect(result.errorMessage).toBeNull();
      expect(result.character?.compatibilityProfile).toBe('MUGEN_1_0');
      expect(readCharacterRuntimeMetadata(result.character!).name).toContain('Alice');
      expect(result.character?.sprites?.sprites.size).toBe(873);
      expect(result.character?.sprites?.palettes?.size).toBe(373);
      expect(result.character?.compatibilityDiagnostics).toContainEqual(expect.objectContaining({
        asset: 'sprite', message: expect.stringContaining('parser=SffV2Parser'),
      }));
      const stand = result.character?.air.actions.find((action) => action.actionNo === 0);
      expect(stand?.elements.length).toBeGreaterThan(1);
      const standKeys = new Set(stand?.elements.map((element) => `${element.groupNo},${element.imageNo}`));
      expect(standKeys.size).toBeGreaterThan(1);
      for (const key of standKeys) expect(result.character?.sprites?.sprites.has(key)).toBe(true);
      expect(result.character?.cns.states.some((state) => state.stateNo === 0)).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 30_000);

  it('classifies the real archive as MUGEN 1.0 from its DEF', () => {
    expect(classifyZipBytes(new Uint8Array(readFileSync(ALICE_ZIP)), 'material-5-archive.zip'))
      .toMatchObject({ kind: 'character', engine: 'mugen_1_0' });
  });
});
