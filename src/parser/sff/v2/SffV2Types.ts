export type SffV2Header = {
  signature: string;
  version: { major: number; minor: number; patch: number; revision: number };
  spriteDirectoryOffset: number;
  spriteCount: number;
  paletteDirectoryOffset: number;
  paletteCount: number;
  ldataOffset: number;
  ldataLength: number;
  tdataOffset: number;
  tdataLength: number;
};

export type SffV2SpriteNode = {
  index: number;
  groupNo: number;
  imageNo: number;
  width: number;
  height: number;
  xAxis: number;
  yAxis: number;
  linkedIndex: number;
  format: number;
  colorDepth: number;
  dataOffset: number;
  dataLength: number;
  paletteIndex: number;
  flags: number;
};

export type SffV2PaletteNode = {
  index: number;
  groupNo: number;
  itemNo: number;
  colorCount: number;
  linkedIndex: number;
  dataOffset: number;
  dataLength: number;
};

export type SffV2Document = {
  buffer: ArrayBuffer;
  header: SffV2Header;
  sprites: SffV2SpriteNode[];
  palettes: SffV2PaletteNode[];
};
