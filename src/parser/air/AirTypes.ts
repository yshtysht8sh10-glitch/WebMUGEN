export type AirDocument = {
  actions: AirAction[];
};

export type AirAction = {
  actionNo: number;
  elements: AirElement[];
  defaultClsn1: AirCollisionBox[];
  defaultClsn2: AirCollisionBox[];
};

export type AirElement = {
  groupNo: number;
  imageNo: number;
  offsetX: number;
  offsetY: number;
  duration: number;
  flip?: string;
  blend?: string;
  clsn1: AirCollisionBox[];
  clsn2: AirCollisionBox[];
};

export type AirCollisionBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
