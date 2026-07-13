import { decodePcx, tryReadVgaPalette } from '../../parser/pcx/PcxDecoder';
import { findSffSprite, getSpriteData, parseSffV1 } from '../../parser/sff/SffParser';
import type { SffDocument, SffSpriteNode } from '../../parser/sff/SffTypes';
import type { ImageDataSprite, ImageDataSpritePack } from './ImageDataSpriteTypes';
import { spriteKey } from './SpritePackLoader';

export type SffSpritePackConverterOptions = {
  externalPalette?: Uint8Array;
  preferExternalPalette?: boolean;
  paletteIndexOrder?: 'normal' | 'reversed';
};

export function convertSffV1ToImageDataSpritePack(
  buffer: ArrayBuffer,
  options: SffSpritePackConverterOptions = {},
): ImageDataSpritePack {
  return convertSffDocumentToImageDataSpritePack(parseSffV1(buffer), options);
}

export function convertSffDocumentToImageDataSpritePack(
  document: SffDocument,
  options: SffSpritePackConverterOptions = {},
): ImageDataSpritePack {
  const sprites = new Map<string, ImageDataSprite>();
  const sharedPalette = options.externalPalette ?? findSharedPalette(document);
  const decodedSources = new Map<string, ReturnType<typeof decodePcx>>();
  const sourcePaletteMetadata = new Map<number, PaletteResolution>();
  let previousPalette: PaletteResolution | null = null;

  for (const sprite of document.sprites) {
    const sourceSprite = resolveLinkedSprite(document, sprite);
    if (!sourceSprite) {
      continue;
    }

    const rawData = getSpriteData(document, sourceSprite);
    if (rawData.length === 0) {
      continue;
    }

    const embeddedPalette = tryReadVgaPalette(rawData);
    const paletteResolution = resolveSpritePalette({
      sprite,
      sourceSprite,
      embeddedPalette,
      previousPalette,
      sharedPalette,
      sourcePaletteMetadata,
      externalPaletteSelected: options.externalPalette !== undefined,
      externalPaletteIndexOrder: options.paletteIndexOrder ?? 'normal',
    });

    if (!sprite.isLinked) {
      previousPalette = paletteResolution;
      sourcePaletteMetadata.set(sprite.index, paletteResolution);
    } else {
      previousPalette = paletteResolution;
    }

    const decodeKey = `${sourceSprite.index}:${paletteResolution.key}`;
    let pcx = decodedSources.get(decodeKey);
    if (!pcx) {
      pcx = tryDecodeSpritePcx(rawData, {
        externalPalette: paletteResolution.palette ?? undefined,
        preferExternalPalette: paletteResolution.palette !== null || options.preferExternalPalette,
        paletteIndexOrder: paletteResolution.paletteIndexOrder,
      }) ?? undefined;
      if (pcx) decodedSources.set(decodeKey, pcx);
    }
    if (!pcx) {
      continue;
    }

    const sampleIndex = pcx.indexedPixels.find((value) => value !== 0) ?? pcx.indexedPixels[0];
    const sampleRgba = sampleIndex === undefined ? undefined : rgbaAt(pcx.rgbaPixels, pcx.indexedPixels, sampleIndex);
    const imagePixels = new Uint8ClampedArray(pcx.rgbaPixels);
    sprites.set(spriteKey(sprite.groupNo, sprite.imageNo), {
      groupNo: sprite.groupNo,
      imageNo: sprite.imageNo,
      xAxis: sprite.xAxis,
      yAxis: sprite.yAxis,
      imageData: new ImageData(imagePixels, pcx.width, pcx.height),
      paletteKey: paletteResolution.key,
      paletteMetadata: {
        source: paletteResolution.source,
        ownerGroupNo: paletteResolution.owner?.groupNo,
        ownerImageNo: paletteResolution.owner?.imageNo,
        ownerSequence: paletteResolution.owner?.index,
        samePaletteRaw: sprite.samePalette ? 1 : 0,
        linked: sprite.isLinked,
        linkedSource: sprite.isLinked ? sprite.linkedIndex : undefined,
        embeddedPalette: embeddedPalette !== null,
        externalActApplied: paletteResolution.externalActApplied,
        sampleIndex,
        sampleRgba,
      },
    });
  }

  return {
    sprites: sprites as ImageDataSpritePack['sprites'],
    cacheKey: `sffv1:${document.header.imageCount}:${document.header.firstSubfileOffset}:${options.externalPalette ? 'act' : 'embedded'}`,
  };
}

type PaletteResolution = {
  palette: Uint8Array | null;
  paletteIndexOrder: 'normal' | 'reversed';
  key: string;
  source: string;
  owner?: Pick<SffSpriteNode, 'groupNo' | 'imageNo' | 'index'>;
  externalActApplied: boolean;
};

function resolveSpritePalette({
  sprite,
  sourceSprite,
  embeddedPalette,
  previousPalette,
  sharedPalette,
  sourcePaletteMetadata,
  externalPaletteSelected,
  externalPaletteIndexOrder,
}: {
  sprite: SffSpriteNode;
  sourceSprite: SffSpriteNode;
  embeddedPalette: Uint8Array | null;
  previousPalette: PaletteResolution | null;
  sharedPalette: Uint8Array | null;
  sourcePaletteMetadata: ReadonlyMap<number, PaletteResolution>;
  externalPaletteSelected: boolean;
  externalPaletteIndexOrder: 'normal' | 'reversed';
}): PaletteResolution {
  if (!sprite.samePalette && !sprite.isLinked && embeddedPalette) {
    return {
      palette: embeddedPalette,
      paletteIndexOrder: 'normal',
      key: `sprite:${sprite.groupNo},${sprite.imageNo}#${sprite.index}`,
      source: 'sprite-specific-pcx',
      owner: sprite,
      externalActApplied: false,
    };
  }

  if (sprite.samePalette && previousPalette) {
    return {
      ...previousPalette,
      key: `${previousPalette.key}:chain:${sprite.groupNo},${sprite.imageNo}#${sprite.index}`,
      source: previousPalette.source === 'external-act' ? 'external-act-chain' : 'sprite-specific-chain',
    };
  }

  if (sprite.isLinked) {
    const sourcePalette = sourcePaletteMetadata.get(sourceSprite.index);
    if (sourcePalette) {
      return {
        ...sourcePalette,
        key: `${sourcePalette.key}:linked:${sprite.groupNo},${sprite.imageNo}#${sprite.index}`,
        source: `${sourcePalette.source}-linked`,
      };
    }
  }

  if (embeddedPalette) {
    return {
      palette: embeddedPalette,
      paletteIndexOrder: 'normal',
      key: `sprite:${sourceSprite.groupNo},${sourceSprite.imageNo}#${sourceSprite.index}`,
      source: 'sprite-specific-pcx',
      owner: sourceSprite,
      externalActApplied: false,
    };
  }

  return {
    palette: sharedPalette,
    paletteIndexOrder: externalPaletteSelected ? externalPaletteIndexOrder : 'normal',
    key: externalPaletteSelected ? 'external-act' : 'shared-embedded',
    source: externalPaletteSelected ? 'external-act' : 'shared-embedded',
    externalActApplied: externalPaletteSelected,
  };
}

function tryDecodeSpritePcx(
  rawData: Uint8Array,
  options: Parameters<typeof decodePcx>[1],
): ReturnType<typeof decodePcx> | null {
  try {
    return decodePcx(rawData, options);
  } catch {
    return null;
  }
}

function rgbaAt(
  rgbaPixels: Uint8ClampedArray,
  indexedPixels: Uint8Array,
  sampleIndex: number,
): [number, number, number, number] | undefined {
  const pixelIndex = indexedPixels.findIndex((value) => value === sampleIndex);
  if (pixelIndex < 0) return undefined;
  const offset = pixelIndex * 4;
  return [
    rgbaPixels[offset],
    rgbaPixels[offset + 1],
    rgbaPixels[offset + 2],
    rgbaPixels[offset + 3],
  ];
}

export function resolveLinkedSprite(
  document: SffDocument,
  sprite: SffSpriteNode,
): SffSpriteNode | undefined {
  if (!sprite.isLinked) {
    return sprite;
  }

  const linkedByIndex = document.sprites[sprite.linkedIndex];
  if (linkedByIndex) {
    return linkedByIndex;
  }

  return findSffSprite(document, sprite.groupNo, sprite.linkedIndex);
}

export function findSharedPalette(document: SffDocument): Uint8Array | null {
  for (const sprite of document.sprites) {
    if (sprite.isLinked) {
      continue;
    }

    const rawData = getSpriteData(document, sprite);
    const palette = tryReadVgaPalette(rawData);
    if (palette) {
      return palette;
    }
  }

  return null;
}
