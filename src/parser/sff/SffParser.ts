import type { SffDocument, SffHeader, SffSpriteNode } from './SffTypes';

const SFF_SIGNATURE = 'ElecbyteSpr\0';
const SFF_V1_SUBHEADER_SIZE = 32;

export function parseSffV1(buffer: ArrayBuffer): SffDocument {
  const view = new DataView(buffer);
  const data = new Uint8Array(buffer);
  const header = parseSffHeader(view);

  if (!header.signature.startsWith('ElecbyteSpr')) {
    throw new Error(`Invalid SFF signature: ${header.signature}`);
  }

  if (header.version.major >= 2) {
    throw new Error('SFF v2 is not supported by the SFF v1 parser.');
  }

  if (header.subheaderSize !== SFF_V1_SUBHEADER_SIZE) {
    throw new Error(`Unsupported SFF subheader size: ${header.subheaderSize}`);
  }

  const sprites: SffSpriteNode[] = [];
  let offset = header.firstSubfileOffset;
  let index = 0;

  while (offset > 0 && offset + SFF_V1_SUBHEADER_SIZE <= buffer.byteLength && index < header.imageCount) {
    const node = parseSffSpriteNode(view, offset, index);
    sprites.push(node);
    offset = node.nextOffset;
    index += 1;
  }

  return {
    header,
    sprites,
    data,
  };
}

export function getSpriteData(document: SffDocument, sprite: SffSpriteNode): Uint8Array {
  if (sprite.isLinked || sprite.length <= 0) {
    return new Uint8Array();
  }

  return document.data.slice(sprite.dataOffset, sprite.dataOffset + sprite.length);
}

export function findSffSprite(
  document: SffDocument,
  groupNo: number,
  imageNo: number,
): SffSpriteNode | undefined {
  return document.sprites.find((sprite) => sprite.groupNo === groupNo && sprite.imageNo === imageNo);
}

function parseSffHeader(view: DataView): SffHeader {
  return {
    signature: readAscii(view, 0, 12),
    version: {
      beta: view.getUint8(12),
      patch: view.getUint8(13),
      minor: view.getUint8(14),
      major: view.getUint8(15),
    },
    groupCount: view.getInt32(16, true),
    imageCount: view.getInt32(20, true),
    firstSubfileOffset: view.getInt32(24, true),
    subheaderSize: view.getInt32(28, true),
    paletteType: view.getUint8(32),
  };
}

function parseSffSpriteNode(view: DataView, offset: number, index: number): SffSpriteNode {
  const nextOffset = view.getInt32(offset, true);
  const length = view.getInt32(offset + 4, true);
  const xAxis = view.getInt16(offset + 8, true);
  const yAxis = view.getInt16(offset + 10, true);
  const groupNo = view.getInt16(offset + 12, true);
  const imageNo = view.getInt16(offset + 14, true);
  const linkedIndex = view.getInt16(offset + 16, true);
  const samePalette = view.getUint8(offset + 18) !== 0;
  const comment = readAscii(view, offset + 19, 13).replace(/\0+$/g, '');
  const dataOffset = offset + SFF_V1_SUBHEADER_SIZE;

  return {
    index,
    nextOffset,
    length,
    xAxis,
    yAxis,
    groupNo,
    imageNo,
    linkedIndex,
    samePalette,
    comment,
    dataOffset,
    isLinked: length === 0 && linkedIndex >= 0,
  };
}

function readAscii(view: DataView, offset: number, length: number): string {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += String.fromCharCode(view.getUint8(offset + i));
  }
  return result;
}
