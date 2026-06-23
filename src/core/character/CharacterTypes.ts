import type { CnsDocument } from '../../mugen/common/cnsTypes';
import type { AirDocument } from '../../parser/air/AirTypes';
import type { CmdDocument } from '../../parser/cmd/CmdTypes';
import type { DefDocument } from '../../parser/def/DefTypes';
import type { ImageDataSpritePack } from '../sprite/ImageDataSpriteTypes';

export type CharacterPaletteAsset = {
  slot: number;
  file: string;
  bytes: Uint8Array;
};

export type CharacterAssets = {
  def: DefDocument;
  cns: CnsDocument;
  air: AirDocument;
  cmd: CmdDocument;
  sprites: ImageDataSpritePack | null;
  palettes: CharacterPaletteAsset[];
};
