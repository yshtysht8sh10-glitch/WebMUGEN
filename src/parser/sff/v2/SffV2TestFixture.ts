export function createSffV2Fixture(): ArrayBuffer {
  const buffer = new ArrayBuffer(1614);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  writeAscii(bytes, 0, 'ElecbyteSpr\0'); bytes[15] = 2;
  view.setUint32(36, 528, true); view.setUint32(40, 2, true);
  view.setUint32(44, 512, true); view.setUint32(48, 1, true);
  view.setUint32(52, 584, true); view.setUint32(56, 1030, true);
  view.setUint32(60, 1614, true); view.setUint32(64, 0, true);
  view.setInt16(512, 1, true); view.setInt16(514, 1, true); view.setUint16(516, 256, true);
  view.setUint32(520, 0, true); view.setUint32(524, 1024, true);
  bytes.set([0, 0, 0, 0, 255, 32, 16, 255], 584);
  writeSprite(view, 528, { image: 0, dataOffset: 1024, dataLength: 6 });
  writeSprite(view, 556, { image: 1, dataOffset: 0, dataLength: 0, x: 7, y: 9 });
  view.setUint32(1608, 4, true); bytes[1612] = 0x44; bytes[1613] = 1;
  return buffer;
}

function writeSprite(view: DataView, offset: number, value: { image: number; dataOffset: number; dataLength: number; x?: number; y?: number }): void {
  view.setInt16(offset, 0, true); view.setInt16(offset + 2, value.image, true);
  view.setUint16(offset + 4, 2, true); view.setUint16(offset + 6, 2, true);
  view.setInt16(offset + 8, value.x ?? 1, true); view.setInt16(offset + 10, value.y ?? 2, true);
  view.setUint16(offset + 12, 0, true); view.setUint8(offset + 14, 2); view.setUint8(offset + 15, 8);
  view.setUint32(offset + 16, value.dataOffset, true); view.setUint32(offset + 20, value.dataLength, true);
  view.setUint16(offset + 24, 0, true); view.setUint16(offset + 26, 0, true);
}

function writeAscii(bytes: Uint8Array, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index);
}
