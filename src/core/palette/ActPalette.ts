export type PaletteColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type ActPalette = {
  colors: PaletteColor[];
};

export type ActPaletteParseOptions = {
  transparentIndex?: number | null;
  channelOrder?: 'rgb' | 'bgr';
};

export function parseActPalette(bytes: Uint8Array, options: ActPaletteParseOptions = {}): ActPalette {
  const transparentIndex = options.transparentIndex === undefined ? 0 : options.transparentIndex;
  const channelOrder = options.channelOrder ?? 'rgb';
  const colorCount = Math.floor(bytes.length / 3);

  if (colorCount === 0) {
    throw new Error('ACT palette must contain at least one RGB triplet');
  }

  const colors = Array.from({ length: Math.min(colorCount, 256) }, (_, index) => {
    const offset = index * 3;
    const c0 = bytes[offset] ?? 0;
    const c1 = bytes[offset + 1] ?? 0;
    const c2 = bytes[offset + 2] ?? 0;
    const [r, g, b] = channelOrder === 'rgb' ? [c0, c1, c2] : [c2, c1, c0];

    return {
      r,
      g,
      b,
      a: transparentIndex === index ? 0 : 255,
    };
  });

  return { colors };
}

export function serializeActPalette(palette: ActPalette, channelOrder: 'rgb' | 'bgr' = 'rgb'): Uint8Array {
  const bytes = new Uint8Array(palette.colors.length * 3);

  palette.colors.forEach((color, index) => {
    const offset = index * 3;
    bytes[offset] = channelOrder === 'rgb' ? color.r : color.b;
    bytes[offset + 1] = color.g;
    bytes[offset + 2] = channelOrder === 'rgb' ? color.b : color.r;
  });

  return bytes;
}

export function getPaletteColor(palette: ActPalette, index: number): PaletteColor {
  return palette.colors[index] ?? { r: 0, g: 0, b: 0, a: 0 };
}
