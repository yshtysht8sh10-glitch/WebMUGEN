import type { CnsDocument } from '../../mugen/common/cnsTypes';
import type { AirDocument } from '../../parser/air/AirTypes';
import type { CmdDocument } from '../../parser/cmd/CmdTypes';
import type { DefDocument } from '../../parser/def/DefTypes';
import type { ImageDataSpritePack } from '../sprite/ImageDataSpriteTypes';
import type { SndDocument } from '../../parser/snd/SndTypes';
import type { CompatibilityProfileId } from '../../compatibility/CompatibilityProfile';

export type CharacterPaletteAsset = {
  slot: number;
  file: string;
  bytes: Uint8Array;
};

export type CharacterAssets = {
  compatibilityProfile: CompatibilityProfileId;
  def: DefDocument;
  cns: CnsDocument;
  air: AirDocument;
  cmd: CmdDocument;
  sprites: ImageDataSpritePack | null;
  palettes: CharacterPaletteAsset[];
  sounds: SndDocument | null;
  loadDiagnostics: CharacterLoadDiagnostic[];
  compatibilityDiagnostics: CharacterLoadDiagnostic[];
  cnsSourceFiles?: CharacterSourceFile[];
};

export type CharacterLoadDiagnostic = {
  asset: 'sound' | 'compatibility' | 'sprite';
  path: string;
  message: string;
};

export type CharacterSourceFile = {
  path: string;
  label: string;
  text: string;
  kind?: 'def' | 'cns' | 'cmd' | 'air' | 'zss' | 'common' | 'text' | 'sff' | 'snd' | 'act' | 'binary';
  binary?: Uint8Array;
  editable?: boolean;
  external?: boolean;
  primary?: boolean;
  archivePath?: string;
  archiveEntryPath?: string;
};
