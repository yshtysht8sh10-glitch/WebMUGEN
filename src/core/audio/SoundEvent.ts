export type SoundPlayEvent = {
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
