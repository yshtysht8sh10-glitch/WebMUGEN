import { describe, expect, it } from 'vitest';
import { findSffSprite, getSpriteData, parseSffV1 } from './SffParser';
import { detectSffFormat } from './SffFormatDetector';

function createFakeSffV1(): ArrayBuffer {
  const buffer = new ArrayBuffer(160);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  writeAscii(bytes, 0, 'ElecbyteSpr\0');
  view.setUint8(12, 0);
  view.setUint8(13, 0);
  view.setUint8(14, 1);
  view.setUint8(15, 1);
  view.setInt32(16, 1, true);
  view.setInt32(20, 2, true);
  view.setInt32(24, 64, true);
  view.setInt32(28, 32, true);
  view.setUint8(32, 1);

  // sprite 0
  view.setInt32(64, 104, true);
  view.setInt32(68, 4, true);
  view.setInt16(72, 16, true);
  view.setInt16(74, 78, true);
  view.setInt16(76, 200, true);
  view.setInt16(78, 2, true);
  view.setInt16(80, -1, true);
  view.setUint8(82, 1);
  writeAscii(bytes, 83, 'sprite0');
  bytes.set([1, 2, 3, 4], 96);

  // sprite 1 linked to sprite 0
  view.setInt32(104, 0, true);
  view.setInt32(108, 0, true);
  view.setInt16(112, 20, true);
  view.setInt16(114, 70, true);
  view.setInt16(116, 200, true);
  view.setInt16(118, 3, true);
  view.setInt16(120, 0, true);
  view.setUint8(122, 1);
  writeAscii(bytes, 123, 'link');

  return buffer;
}

function writeAscii(bytes: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    bytes[offset + i] = text.charCodeAt(i);
  }
}

describe('SffParser', () => {
  it('parses SFF v1 header', () => {
    const buffer = createFakeSffV1();
    expect(detectSffFormat(buffer)).toEqual({ format: 'SFF_V1', version: '1.1.0.0', parser: 'SffV1Parser' });
    const doc = parseSffV1(buffer);

    expect(doc.header.signature).toBe('ElecbyteSpr\0');
    expect(doc.header.version.major).toBe(1);
    expect(doc.header.version.minor).toBe(1);
    expect(doc.header.imageCount).toBe(2);
    expect(doc.header.firstSubfileOffset).toBe(64);
  });

  it('parses sprite nodes', () => {
    const doc = parseSffV1(createFakeSffV1());

    expect(doc.sprites).toHaveLength(2);
    expect(doc.sprites[0]).toMatchObject({
      groupNo: 200,
      imageNo: 2,
      xAxis: 16,
      yAxis: 78,
      length: 4,
      isLinked: false,
    });
    expect(doc.sprites[1]).toMatchObject({
      groupNo: 200,
      imageNo: 3,
      linkedIndex: 0,
      isLinked: true,
    });
  });

  it('finds sprite and returns raw data', () => {
    const doc = parseSffV1(createFakeSffV1());
    const sprite = findSffSprite(doc, 200, 2);

    expect(sprite).toBeDefined();
    expect(Array.from(getSpriteData(doc, sprite!))).toEqual([1, 2, 3, 4]);
  });

  it('accepts a WinMUGEN-era v1 file that writes the 512-byte main header size into the subheader field', () => {
    const buffer = new ArrayBuffer(600);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    writeAscii(bytes, 0, 'ElecbyteSpr\0');
    view.setUint8(13, 1);
    view.setUint8(15, 1);
    view.setInt32(16, 1, true);
    view.setInt32(20, 2, true);
    view.setInt32(24, 512, true);
    view.setInt32(28, 512, true);
    view.setUint8(32, 1);
    view.setInt32(512, 548, true);
    view.setInt32(516, 4, true);
    view.setInt16(520, 16, true);
    view.setInt16(522, 78, true);
    view.setInt16(524, 200, true);
    view.setInt16(526, 2, true);
    bytes.set([0x0a, 2, 3, 4], 544);
    view.setInt32(548, 0, true);
    view.setInt32(552, 0, true);
    view.setInt16(560, 200, true);
    view.setInt16(562, 3, true);
    view.setInt16(564, 0, true);

    const doc = parseSffV1(buffer);

    expect(doc.header.subheaderSize).toBe(512);
    expect(doc.sprites).toHaveLength(2);
    expect(doc.sprites[0]).toMatchObject({ groupNo: 200, imageNo: 2, dataOffset: 544 });
  });

  it('still rejects unknown or structurally invalid v1 subheader sizes', () => {
    const unknown = createFakeSffV1();
    new DataView(unknown).setInt32(28, 64, true);
    expect(() => parseSffV1(unknown)).toThrow('Unsupported SFF subheader size: 64');

    const invalidMiswrite = createFakeSffV1();
    new DataView(invalidMiswrite).setInt32(28, 512, true);
    expect(() => parseSffV1(invalidMiswrite)).toThrow('Unsupported SFF subheader size: 512');
  });
});
