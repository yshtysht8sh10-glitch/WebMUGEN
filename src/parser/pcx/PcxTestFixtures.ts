export function createFake8BitPcx(withPalette = true): Uint8Array {
  const width = 2;
  const height = 1;
  const bytesPerLine = 2;
  const header = new Uint8Array(128);
  const view = new DataView(header.buffer);

  header[0] = 0x0a;
  header[1] = 5;
  header[2] = 1;
  header[3] = 8;
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, width - 1, true);
  view.setUint16(10, height - 1, true);
  header[65] = 1;
  view.setUint16(66, bytesPerLine, true);
  view.setUint16(68, 1, true);

  const imageData = new Uint8Array([0, 1]);
  const palette = new Uint8Array(256 * 3);
  palette[0] = 10;
  palette[1] = 20;
  palette[2] = 30;
  palette[3] = 40;
  palette[4] = 50;
  palette[5] = 60;
  palette[254 * 3] = 70;
  palette[254 * 3 + 1] = 80;
  palette[254 * 3 + 2] = 90;
  palette[255 * 3] = 90;
  palette[255 * 3 + 1] = 100;
  palette[255 * 3 + 2] = 110;

  if (!withPalette) {
    const result = new Uint8Array(header.length + imageData.length);
    result.set(header, 0);
    result.set(imageData, header.length);
    return result;
  }

  const paletteMarker = new Uint8Array([0x0c]);
  const result = new Uint8Array(header.length + imageData.length + paletteMarker.length + palette.length);
  result.set(header, 0);
  result.set(imageData, header.length);
  result.set(paletteMarker, header.length + imageData.length);
  result.set(palette, header.length + imageData.length + paletteMarker.length);
  return result;
}
