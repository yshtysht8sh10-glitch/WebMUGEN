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

export type SoundRuntimeEvent = SoundPlayEvent | SoundStopEvent;
