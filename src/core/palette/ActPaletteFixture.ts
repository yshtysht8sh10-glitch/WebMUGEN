import { parseActPalette, type ActPalette } from './ActPalette';

export function createTestActBytes(): Uint8Array {
  const bytes = new Uint8Array(256 * 3);

  bytes.set([0, 0, 0], 0);
  bytes.set([255, 0, 0], 3);
  bytes.set([0, 255, 0], 6);
  bytes.set([0, 0, 255], 9);

  return bytes;
}

export function createTestActPalette(): ActPalette {
  return parseActPalette(createTestActBytes(), { transparentIndex: 0 });
}
