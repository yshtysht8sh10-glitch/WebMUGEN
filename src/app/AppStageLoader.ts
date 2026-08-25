import { unzipSync } from 'fflate';
import { convertSffV1ToImageDataSpritePack } from '../core/sprite/SffSpritePackConverter';
import type { MugenStage, MugenStageLayer } from '../core/stage/MugenStage';
import { getDefSection, getDefValue, parseDefText } from '../parser/def/DefParser';
import { selectPreferredDefCandidate } from '../content/DefCandidateSelection';
import { decodeMugenText } from '../parser/text/MugenTextDecoder';

export async function loadMugenStageZip(zipPath: string): Promise<MugenStage> {
  const response = await fetch(zipPath);
  if (!response.ok) throw new Error(`Stage ZIP load failed: HTTP ${response.status}`);
  const entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const files = new Map<string, Uint8Array>();
  for (const [name, bytes] of Object.entries(entries)) {
    if (!name.endsWith('/')) files.set(normalizePath(name), bytes);
  }

  const candidates = Array.from(files.entries())
    .filter(([path]) => path.toLowerCase().endsWith('.def'))
    .map(([path, bytes]) => ({ path, def: parseDefText(decodeMugenText(bytes)) }))
    .filter(({ def }) => Boolean(getDefSection(def, 'BGDef') && getDefValue(def, 'BGDef', 'spr')));
  if (candidates.length === 0) throw new Error('Stage ZIP does not contain a valid Stage DEF.');
  const selected = selectPreferredDefCandidate(candidates);
  const { path: defPath, def } = selected;
  const spriteName = getDefValue(def, 'BGDef', 'spr');
  if (!spriteName) throw new Error(`Stage DEF has no BGDef spr: ${defPath}`);
  const spritePath = resolveSibling(defPath, spriteName);
  const spriteBytes = files.get(normalizePath(spritePath));
  if (!spriteBytes) throw new Error(`Stage SFF is missing: ${spritePath}`);

  const layers: MugenStageLayer[] = [];
  for (const section of def.sections) {
    if (!/^bg(?:\s|$)/i.test(section.name)) continue;
    if ((section.values.get('type') ?? 'normal').trim().toLowerCase() !== 'normal') continue;
    const spriteNo = parsePair(section.values.get('spriteno'));
    if (!spriteNo) continue;
    const start = parsePair(section.values.get('start')) ?? [0, 0];
    const delta = parsePair(section.values.get('delta')) ?? [1, 1];
    layers.push({
      groupNo: spriteNo[0],
      imageNo: spriteNo[1],
      layerNo: parseNumber(section.values.get('layerno'), 0),
      startX: start[0],
      startY: start[1],
      deltaX: delta[0],
      deltaY: delta[1],
    });
  }
  if (layers.length === 0) throw new Error(`Stage DEF has no supported normal BG layers: ${defPath}`);

  const camera = getDefSection(def, 'Camera');
  const playerInfo = getDefSection(def, 'PlayerInfo');
  const screenBound = getDefSection(def, 'Bound');

  return {
    name: getDefValue(def, 'Info', 'name') ?? defPath,
    defPath,
    hiRes: parseNumber(getDefSection(def, 'StageInfo')?.values.get('hires'), 0) !== 0,
    autoTurn: parseNumber(getDefSection(def, 'StageInfo')?.values.get('autoturn'), 1) !== 0,
    zOffset: parseNumber(getDefSection(def, 'StageInfo')?.values.get('zoffset'), 220),
    camera: {
      startX: parseNumber(camera?.values.get('startx'), 0),
      startY: parseNumber(camera?.values.get('starty'), 0),
      boundLeft: parseNumber(camera?.values.get('boundleft'), -160),
      boundRight: parseNumber(camera?.values.get('boundright'), 160),
      boundHigh: parseNumber(camera?.values.get('boundhigh'), -25),
      boundLow: parseNumber(camera?.values.get('boundlow'), 0),
      verticalFollow: parseNumber(camera?.values.get('verticalfollow'), 0.2),
      floorTension: parseNumber(camera?.values.get('floortension'), 0),
      tension: parseNumber(camera?.values.get('tension'), 50),
    },
    playerInfo: {
      p1StartX: parseNumber(playerInfo?.values.get('p1startx'), -70),
      p1StartY: parseNumber(playerInfo?.values.get('p1starty'), 0),
      p1Facing: parseFacing(playerInfo?.values.get('p1facing'), 1),
      p2StartX: parseNumber(playerInfo?.values.get('p2startx'), 70),
      p2StartY: parseNumber(playerInfo?.values.get('p2starty'), 0),
      p2Facing: parseFacing(playerInfo?.values.get('p2facing'), -1),
      leftBound: parseNumber(playerInfo?.values.get('leftbound'), -1000),
      rightBound: parseNumber(playerInfo?.values.get('rightbound'), 1000),
    },
    screenBound: {
      left: parseNumber(screenBound?.values.get('screenleft'), 15),
      right: parseNumber(screenBound?.values.get('screenright'), 15),
    },
    sprites: convertSffV1ToImageDataSpritePack(toArrayBuffer(spriteBytes)),
    layers: layers.sort((left, right) => left.layerNo - right.layerNo),
  };
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

function resolveSibling(basePath: string, relativePath: string): string {
  const parts = basePath.replace(/\\/g, '/').split('/');
  parts.pop();
  for (const part of relativePath.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function parsePair(value: string | undefined): [number, number] | null {
  if (!value) return null;
  const values = value.split(',').map((part) => Number(part.trim()));
  return values.length >= 2 && values.slice(0, 2).every(Number.isFinite)
    ? [values[0], values[1]]
    : null;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const number = Number(value?.trim());
  return Number.isFinite(number) ? number : fallback;
}

function parseFacing(value: string | undefined, fallback: 1 | -1): 1 | -1 {
  return parseNumber(value, fallback) < 0 ? -1 : 1;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
