export type DefSection = {
  name: string;
  values: Map<string, string>;
};

export type DefDocument = {
  sections: DefSection[];
};

export type CharacterDefFiles = {
  cmd?: string;
  cns?: string;
  st?: string[];
  sprite?: string;
  anim?: string;
  sound?: string;
};
