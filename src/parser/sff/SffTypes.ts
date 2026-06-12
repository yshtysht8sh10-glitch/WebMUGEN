export type SffVersion = {
  major: number;
  minor: number;
  patch: number;
  beta: number;
};

export type SffHeader = {
  signature: string;
  version: SffVersion;
  groupCount: number;
  imageCount: number;
  firstSubfileOffset: number;
  subheaderSize: number;
  paletteType: number;
};

export type SffSpriteNode = {
  index: number;
  nextOffset: number;
  length: number;
  xAxis: number;
  yAxis: number;
  groupNo: number;
  imageNo: number;
  linkedIndex: number;
  samePalette: boolean;
  comment: string;
  dataOffset: number;
  isLinked: boolean;
};

export type SffDocument = {
  header: SffHeader;
  sprites: SffSpriteNode[];
  data: Uint8Array;
};
