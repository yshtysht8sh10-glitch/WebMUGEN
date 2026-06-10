export type MugenVersion = 'winmugen' | 'mugen1.0' | 'mugen1.1';

export type CnsDocument = {
  versionHint: MugenVersion | 'unknown';
  states: CnsStateDefinition[];
};

export type CnsStateDefinition = {
  stateNo: number;
  stateType?: string;
  moveType?: string;
  physics?: string;
  initialAnim?: number;
  ctrl?: boolean;
  controllers: CnsStateController[];
};

export type CnsStateController = {
  type: string;
  triggers: CnsTrigger[];
  params: Record<string, CnsValue>;
  source?: CnsSourceLocation;
};

export type CnsTrigger = {
  index: number;
  expression: string;
};

export type CnsValue = string | number | boolean | number[] | string[];

export type CnsSourceLocation = {
  file?: string;
  line: number;
};
