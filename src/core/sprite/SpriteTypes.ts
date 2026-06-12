export type SpriteKey = `${number},${number}`;

export type SpriteDefinition = {
  groupNo: number;
  imageNo: number;
  src: string;
  xAxis: number;
  yAxis: number;
};

export type SpritePackManifest = {
  sprites: SpriteDefinition[];
};

export type LoadedSprite = SpriteDefinition & {
  image: HTMLImageElement;
};

export type SpritePack = {
  sprites: Map<SpriteKey, LoadedSprite>;
};
