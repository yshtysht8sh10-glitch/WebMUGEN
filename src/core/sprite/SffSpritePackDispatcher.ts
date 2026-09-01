import type { CompatibilityProfile } from '../../compatibility/CompatibilityProfile';
import { detectSffFormat, type SffFormatDetection } from '../../parser/sff/SffFormatDetector';
import type { ImageDataSpritePack } from './ImageDataSpriteTypes';
import { convertSffV1ToImageDataSpritePack, type SffSpritePackConverterOptions } from './SffSpritePackConverter';
import { convertSffV2ToImageDataSpritePack } from './SffV2SpritePackConverter';

export type SffSpritePackLoadResult = { pack: ImageDataSpritePack; detection: SffFormatDetection };

export function loadSffSpritePack(
  profile: CompatibilityProfile,
  buffer: ArrayBuffer,
  options: SffSpritePackConverterOptions = {},
): SffSpritePackLoadResult {
  const detection = detectSffFormat(buffer);
  // The profile owns the resource policy; the actual file header owns parser selection.
  // MUGEN 1.0 accepts both legacy v1 and v2 resources. WinMUGEN remains v1-only.
  if (profile.id === 'WINMUGEN' && detection.format !== 'SFF_V1') {
    throw new Error(`${profile.label} profile cannot load ${detection.version} with ${detection.parser}.`);
  }
  return {
    detection,
    pack: detection.format === 'SFF_V1'
      ? convertSffV1ToImageDataSpritePack(buffer, options)
      : convertSffV2ToImageDataSpritePack(buffer),
  };
}
