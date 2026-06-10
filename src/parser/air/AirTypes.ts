export type AirDocument = {
  actions: AirAction[];
};

export type AirAction = {
  actionNo: number;
  elements: AirElement[];
};

export type AirElement = {
  groupNo: number;
  imageNo: number;
  offsetX: number;
  offsetY: number;
  duration: number;
  flip?: string;
  blend?: string;
};
