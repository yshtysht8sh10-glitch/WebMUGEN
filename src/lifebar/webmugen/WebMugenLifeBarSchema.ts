export type WebMugenLifeBarDefinition = {
  format: 'webmugen-lifebar';
  version: 1;
  id: string;
  name: string;
  layout: 'responsive';
  palette: { panel: string; life: string; danger: string; power: string; accent: string; text: string };
  show: { life: boolean; power: boolean; timer: boolean; round: boolean; wins: boolean };
  sourcePath: string;
};
