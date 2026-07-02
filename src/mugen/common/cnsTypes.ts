export type CnsValue = string | number | boolean | Array<string | number>;

export type CnsTrigger = {
  name: string;
  expression: string;
};

export type CnsStateController = {
  type: string;
  triggers: CnsTrigger[];
  params: Record<string, CnsValue>;
};

export type CnsStateDefinition = {
  stateNo: number;
  stateType?: string;
  moveType?: string;
  physics?: string;
  initialAnim?: number;
  ctrl?: boolean;
  powerAdd?: number;
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
