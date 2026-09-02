import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  getCharacterDefFiles,
  loadSffSpritePack,
  parseDefText,
  resolveCompatibilityProfile,
} from './ProxyReleasePreviewApi';

class FakeImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
}

(globalThis as unknown as { ImageData: typeof ImageData }).ImageData =
  FakeImageData as unknown as typeof ImageData;

describe('ProxyReleasePreviewApi', () => {
  it('exposes the same DEF palette and SFF v1 ACT pipeline used by WebMUGEN', async () => {
    const def = parseDefText(await readFile('public/chars/kfm/kfm.def', 'utf8'));
    const files = getCharacterDefFiles(def);
    const act = await readFile(`public/chars/kfm/${files.palettes?.[0].file}`);
    const sff = await readFile(`public/chars/kfm/${files.sprite}`);

    expect(files.palettes?.[0]).toEqual({ slot: 1, file: 'kfm6.act' });

    const result = loadSffSpritePack(resolveCompatibilityProfile(def).profile, exactBuffer(sff), {
      externalPalette: act,
      externalPaletteSlot: 1,
      preferExternalPalette: true,
      paletteIndexOrder: 'reversed',
    });

    expect(result.detection.format).toBe('SFF_V1');
    expect(result.pack.sprites.get('0,0')?.paletteMetadata).toMatchObject({
      source: 'external-act',
      externalActApplied: true,
      paletteIndexOrder: 'reversed',
    });
  });
});

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
