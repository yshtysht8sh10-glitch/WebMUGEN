export type SoundPlayEvent = {
  type: 'play';
  ownerId: number;
  scope: 'character' | 'common';
  group: number;
  index: number;
  channel: number | null;
  volume: number;
  volumeScale: number;
  pan: number;
  absolutePan: boolean;
  frequencyMultiplier: number;
  loop: boolean;
};

export type SoundStopEvent = {
  type: 'stop';
  ownerId: number;
  channel: number | null;
};

export type SoundPanEvent = {
  type: 'pan';
  ownerId: number;
  channel: number | null;
  pan: number | null;
  mode: 'pan' | 'abspan' | null;
};

export type SoundRuntimeEvent = SoundPlayEvent | SoundStopEvent | SoundPanEvent;
