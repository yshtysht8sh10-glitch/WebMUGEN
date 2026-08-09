export type WebMugenStageLayer = {
  type: 'image';
  id: string;
  src: string;
  zIndex: number;
  fit: 'cover';
  cameraFactor: [number, number];
  viewportBand: [number, number];
  parallax: number;
  parallaxY: number;
  pass: 'background' | 'foreground';
};

export type WebMugenStagePresentation = 'image' | 'fresh' | 'cyber' | 'fresh-clasic' | 'cyber-clasic';

export type WebMugenStageDefinition = {
  format: 'webmugen-stage';
  version: 1;
  id: string;
  name: string;
  presentation: WebMugenStagePresentation;
  groundY: number;
  autoTurn: boolean;
  players: { p1Start: [number, number]; p2Start: [number, number] };
  camera: { boundLeft: number; boundRight: number; boundHigh: number; boundLow: number; verticalFollow: number; tension: number };
  layers: WebMugenStageLayer[];
  sourcePath: string;
};
