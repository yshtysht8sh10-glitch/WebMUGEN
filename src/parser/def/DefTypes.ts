export type DefSection = {
  name: string;
  values: Map<string, string>;
};

export type DefDocument = {
  sections: DefSection[];
};

export type CharacterDefPalette = {
  slot: number;
  file: string;
};

export type CharacterDefFiles = {
  cmd?: string;
  cns?: string;
  st?: string[];
  stcommon?: string;
  sprite?: string;
  anim?: string;
  sound?: string;
  palettes?: CharacterDefPalette[];
};
