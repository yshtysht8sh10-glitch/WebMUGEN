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

  for (const sprite of document.sprites) {
    const sourceSprite = resolveLinkedSprite(document, sprite);
    if (!sourceSprite) {
      continue;
    }

    const rawData = getSpriteData(document, sourceSprite);
    if (rawData.length === 0) {
      continue;
    }

    const pcx = tryDecodeSpritePcx(rawData, {
      externalPalette: sharedPalette ?? undefined,
      preferExternalPalette: options.preferExternalPalette,
      paletteIndexOrder: options.paletteIndexOrder,
    });
    if (!pcx) {
      continue;
    }

    sprites.set(spriteKey(sprite.groupNo, sprite.imageNo), {
      groupNo: sprite.groupNo,
      imageNo: sprite.imageNo,
      xAxis: sprite.xAxis,
      yAxis: sprite.yAxis,
      imageData: new ImageData(pcx.rgbaPixels, pcx.width, pcx.height),
    });
  }

  return {
    sprites: sprites as ImageDataSpritePack['sprites'],
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
