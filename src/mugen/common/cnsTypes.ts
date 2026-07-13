export type CnsValue = string | number | boolean | Array<string | number | boolean>;

export type CnsTrigger = {
  name: string;
  expression: string;
};

export type CnsStateController = {
  type: string;
  triggers: CnsTrigger[];
  params: Record<string, CnsValue>;
  sourceFile?: string;
  sourceLine?: number;
};

export type CnsStateDefinition = {
  stateNo: number;
  sourceFile?: string;
  sourceLine?: number;
  source?: 'character' | 'common' | 'mixed';
  sourceLabel?: string;
  stateType?: string;
  moveType?: string;
  physics?: string;
  initialAnim?: number;
  velocitySet?: { x: number; y: number };
  ctrl?: boolean;
  powerAdd?: number;
  juggle?: number;
  faceP2?: boolean;
  hitDefPersist?: boolean;
  moveHitPersist?: boolean;
  hitCountPersist?: boolean;
  controllers: CnsStateController[];
};

export type CnsMetadataSection = {
  name: string;
  values: Record<string, CnsValue>;
};

export type CnsDocument = {
  states: CnsStateDefinition[];
  metadataSections: CnsMetadataSection[];
};
