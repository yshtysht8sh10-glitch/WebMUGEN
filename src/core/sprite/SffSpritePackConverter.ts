import { decodePcx } from '../../parser/pcx/PcxDecoder';
import { findSffSprite, getSpriteData, parseSffV1 } from '../../parser/sff/SffParser';
import type { SffDocument, SffSpriteNode } from '../../parser/sff/SffTypes';
import { spriteKey } from './SpritePackLoader';
import type { ImageDataSprite, ImageDataSpritePack } from './ImageDataSpriteTypes';

export function convertSffV1ToImageDataSpritePack(buffer: ArrayBuffer): ImageDataSpritePack {
  return convertSffDocumentToImageDataSpritePack(parseSffV1(buffer));
}

export function convertSffDocumentToImageDataSpritePack(document: SffDocument): ImageDataSpritePack {
  const sprites = new Map<string, ImageDataSprite>();

  for (const sprite of document.sprites) {
    const sourceSprite = resolveLinkedSprite(document, sprite);
    if (!sourceSprite) {
      continue;
    }

    const rawData = getSpriteData(document, sourceSprite);
    if (rawData.length === 0) {
      continue;
    }

    const pcx = decodePcx(rawData);

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
