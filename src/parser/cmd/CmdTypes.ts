export type CmdDocument = {
  commands: CmdCommand[];
};

export type CmdCommand = {
  name: string;
  command: string;
  time?: number;
};
