import type { SffV2Document, SffV2Header, SffV2PaletteNode, SffV2SpriteNode } from './SffV2Types';

const HEADER_SIZE = 512;
const SPRITE_NODE_SIZE = 28;
const PALETTE_NODE_SIZE = 16;

export function parseSffV2(buffer: ArrayBuffer): SffV2Document {
  if (buffer.byteLength < HEADER_SIZE) throw new Error('SFF v2 header is truncated.');
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const signature = String.fromCharCode(...bytes.subarray(0, 12));
  const version = { major: bytes[15], minor: bytes[14], patch: bytes[13], revision: bytes[12] };
  if (signature !== 'ElecbyteSpr\0') throw new Error('Invalid SFF v2 signature.');
  if (version.major !== 2) throw new Error(`SFF v${version.major} is not supported by the SFF v2 parser.`);
  const header: SffV2Header = {
    signature, version,
    spriteDirectoryOffset: view.getUint32(36, true),
    spriteCount: view.getUint32(40, true),
    paletteDirectoryOffset: view.getUint32(44, true),
    paletteCount: view.getUint32(48, true),
    ldataOffset: view.getUint32(52, true),
    ldataLength: view.getUint32(56, true),
    tdataOffset: view.getUint32(60, true),
    tdataLength: view.getUint32(64, true),
  };
  assertRange(buffer, header.spriteDirectoryOffset, header.spriteCount * SPRITE_NODE_SIZE, 'sprite directory');
  assertRange(buffer, header.paletteDirectoryOffset, header.paletteCount * PALETTE_NODE_SIZE, 'palette directory');
  assertRange(buffer, header.ldataOffset, header.ldataLength, 'LData');
  assertRange(buffer, header.tdataOffset, header.tdataLength, 'TData');
  const sprites: SffV2SpriteNode[] = [];
  for (let index = 0; index < header.spriteCount; index += 1) {
    const offset = header.spriteDirectoryOffset + index * SPRITE_NODE_SIZE;
    sprites.push({
      index,
      groupNo: view.getInt16(offset, true), imageNo: view.getInt16(offset + 2, true),
      width: view.getUint16(offset + 4, true), height: view.getUint16(offset + 6, true),
      xAxis: view.getInt16(offset + 8, true), yAxis: view.getInt16(offset + 10, true),
      linkedIndex: view.getUint16(offset + 12, true), format: view.getUint8(offset + 14),
      colorDepth: view.getUint8(offset + 15), dataOffset: view.getUint32(offset + 16, true),
      dataLength: view.getUint32(offset + 20, true), paletteIndex: view.getUint16(offset + 24, true),
      flags: view.getUint16(offset + 26, true),
    });
  }
  const palettes: SffV2PaletteNode[] = [];
  for (let index = 0; index < header.paletteCount; index += 1) {
    const offset = header.paletteDirectoryOffset + index * PALETTE_NODE_SIZE;
    palettes.push({
      index, groupNo: view.getInt16(offset, true), itemNo: view.getInt16(offset + 2, true),
      colorCount: view.getUint16(offset + 4, true), linkedIndex: view.getUint16(offset + 6, true),
      dataOffset: view.getUint32(offset + 8, true), dataLength: view.getUint32(offset + 12, true),
    });
  }
  return { buffer, header, sprites, palettes };
}

export function getSffV2SpriteData(document: SffV2Document, sprite: SffV2SpriteNode): Uint8Array {
  if (sprite.dataLength === 0) return new Uint8Array();
  if ((sprite.flags & 1) !== 0) {
    throw new Error(`SFF v2 TData sprite ${sprite.groupNo},${sprite.imageNo} is unsupported.`);
  }
  const offset = document.header.ldataOffset + sprite.dataOffset;
  assertRange(document.buffer, offset, sprite.dataLength, `sprite ${sprite.groupNo},${sprite.imageNo} data`);
  return new Uint8Array(document.buffer, offset, sprite.dataLength);
}

export function resolveSffV2LinkedSprite(document: SffV2Document, sprite: SffV2SpriteNode): SffV2SpriteNode {
  let current = sprite;
  const seen = new Set<number>();
  while (current.dataLength === 0) {
    if (seen.has(current.index)) throw new Error(`SFF v2 linked sprite cycle at index ${current.index}.`);
    seen.add(current.index);
    const linked = document.sprites[current.linkedIndex];
    if (!linked) throw new Error(`SFF v2 sprite ${current.index} links to invalid index ${current.linkedIndex}.`);
    current = linked;
  }
  return current;
}

export function resolveSffV2Palette(document: SffV2Document, index: number): { node: SffV2PaletteNode; bytes: Uint8Array } {
  let node = document.palettes[index];
  if (!node) throw new Error(`SFF v2 sprite references invalid palette index ${index}.`);
  const seen = new Set<number>();
  while (node.dataLength === 0) {
    if (seen.has(node.index)) throw new Error(`SFF v2 linked palette cycle at index ${node.index}.`);
    seen.add(node.index);
    const linked = document.palettes[node.linkedIndex];
    if (!linked) throw new Error(`SFF v2 palette ${node.index} links to invalid index ${node.linkedIndex}.`);
    node = linked;
  }
  const offset = document.header.ldataOffset + node.dataOffset;
  assertRange(document.buffer, offset, node.dataLength, `palette ${node.index} data`);
  return { node, bytes: new Uint8Array(document.buffer, offset, node.dataLength) };
}

function assertRange(buffer: ArrayBuffer, offset: number, length: number, label: string): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > buffer.byteLength) {
    throw new Error(`SFF v2 ${label} is outside the file.`);
  }
}
