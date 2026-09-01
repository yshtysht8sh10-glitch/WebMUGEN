import { getSffV2SpriteData, parseSffV2, resolveSffV2LinkedSprite, resolveSffV2Palette } from '../../parser/sff/v2/SffV2Parser';
import { decodeSffV2Rle8 } from '../../parser/sff/v2/SffV2Rle8';
import type { SffV2Document, SffV2SpriteNode } from '../../parser/sff/v2/SffV2Types';
import type { ImageDataPalette, ImageDataSprite, ImageDataSpritePack } from './ImageDataSpriteTypes';
import { spriteKey } from './SpritePackLoader';

export function convertSffV2ToImageDataSpritePack(buffer: ArrayBuffer): ImageDataSpritePack {
  return convertSffV2DocumentToImageDataSpritePack(parseSffV2(buffer));
}

export function convertSffV2DocumentToImageDataSpritePack(document: SffV2Document): ImageDataSpritePack {
  const sprites = new Map<string, ImageDataSprite>();
  const palettes = new Map<string, ImageDataPalette>();
  const indexedBySource = new Map<number, Uint8Array>();
  let previewKey: string | null = null;
  let previewPriority = -1;

  for (const paletteNode of document.palettes) {
    const resolved = resolveSffV2Palette(document, paletteNode.index);
    palettes.set(paletteKey(paletteNode.groupNo, paletteNode.itemNo, paletteNode.index), {
      bytes: new Uint8Array(resolved.bytes), indexOrder: 'normal',
    });
  }

  for (const sprite of document.sprites) {
    const source = resolveSffV2LinkedSprite(document, sprite);
    const indexedPixels = decodeSource(document, source, indexedBySource);
    const paletteDirectoryNode = document.palettes[sprite.paletteIndex];
    if (!paletteDirectoryNode) throw new Error(`SFF v2 sprite references invalid palette index ${sprite.paletteIndex}.`);
    const palette = resolveSffV2Palette(document, sprite.paletteIndex);
    const spritePaletteKey = paletteKey(paletteDirectoryNode.groupNo, paletteDirectoryNode.itemNo, paletteDirectoryNode.index);
    const rgba = applyPalette(indexedPixels, palette.bytes);
    const key = spriteKey(sprite.groupNo, sprite.imageNo);
    const priority = sprite.groupNo === 0 && sprite.imageNo === 0 ? 2 : sprite.groupNo === 0 ? 1 : 0;
    const retainIndexed = priority > previewPriority;
    if (retainIndexed && previewKey) {
      const previous = sprites.get(previewKey);
      if (previous) previous.indexedPixels = undefined;
    }
    if (retainIndexed) { previewKey = key; previewPriority = priority; }
    const sampleIndex = indexedPixels.find((value) => value !== 0) ?? indexedPixels[0];
    sprites.set(key, {
      groupNo: sprite.groupNo, imageNo: sprite.imageNo,
      xAxis: sprite.xAxis, yAxis: sprite.yAxis,
      imageData: new ImageData(rgba, source.width, source.height),
      indexedPixels: retainIndexed ? new Uint8Array(indexedPixels) : undefined,
      paletteKey: spritePaletteKey,
      paletteMetadata: {
        source: 'sffv2-palette-directory',
        ownerGroupNo: palette.node.groupNo, ownerImageNo: palette.node.itemNo,
        ownerSequence: palette.node.index, samePaletteRaw: sprite.paletteIndex,
        linked: sprite.dataLength === 0, linkedSource: sprite.dataLength === 0 ? sprite.linkedIndex : undefined,
        embeddedPalette: true, externalActApplied: false, paletteIndexOrder: 'normal', sampleIndex,
        sampleRgba: sampleIndex === undefined ? undefined : paletteRgba(palette.bytes, sampleIndex),
      },
    });
  }
  return {
    sprites: sprites as ImageDataSpritePack['sprites'], palettes,
    cacheKey: `sffv2:${document.header.spriteCount}:${document.header.paletteCount}:${document.header.ldataOffset}`,
  };
}

function paletteKey(groupNo: number, itemNo: number, index: number): string {
  return `sffv2:${groupNo},${itemNo}#${index}`;
}

function decodeSource(document: SffV2Document, source: SffV2SpriteNode, cache: Map<number, Uint8Array>): Uint8Array {
  const cached = cache.get(source.index);
  if (cached) return cached;
  if (source.colorDepth !== 8) throw new Error(`SFF v2 sprite ${source.groupNo},${source.imageNo} uses unsupported color depth ${source.colorDepth}.`);
  if (source.format === 3) throw new Error(`SFF v2 RLE5 sprite ${source.groupNo},${source.imageNo} is unsupported.`);
  if (source.format === 4) throw new Error(`SFF v2 LZ5 sprite ${source.groupNo},${source.imageNo} is unsupported.`);
  if (source.format !== 2) throw new Error(`SFF v2 sprite ${source.groupNo},${source.imageNo} uses unsupported format ${source.format}.`);
  const pixels = decodeSffV2Rle8(getSffV2SpriteData(document, source), source.width * source.height);
  cache.set(source.index, pixels);
  return pixels;
}

function applyPalette(indexes: Uint8Array, palette: Uint8Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(indexes.length * 4);
  for (let pixel = 0; pixel < indexes.length; pixel += 1) {
    const source = indexes[pixel] * 4;
    const target = pixel * 4;
    rgba[target] = palette[source] ?? 0;
    rgba[target + 1] = palette[source + 1] ?? 0;
    rgba[target + 2] = palette[source + 2] ?? 0;
    rgba[target + 3] = indexes[pixel] === 0 ? 0 : (palette[source + 3] ?? 255);
  }
  return rgba;
}

function paletteRgba(palette: Uint8Array, index: number): [number, number, number, number] {
  const offset = index * 4;
  return [palette[offset] ?? 0, palette[offset + 1] ?? 0, palette[offset + 2] ?? 0, index === 0 ? 0 : (palette[offset + 3] ?? 255)];
}
