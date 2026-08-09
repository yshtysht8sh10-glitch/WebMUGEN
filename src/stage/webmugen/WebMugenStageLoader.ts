import type { WebMugenStageDefinition, WebMugenStageLayer } from './WebMugenStageSchema';

export async function loadWebMugenStage(
  path: string,
  fetcher: (input: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }> = fetch,
): Promise<WebMugenStageDefinition> {
  if ((!path.startsWith('/stages/webmugen/') && !path.startsWith('/content/')) || !path.endsWith('.json') || path.includes('..') || path.includes('://')) {
    throw new Error('WebMUGEN stage loader accepts only same-origin /stages/webmugen/ or /content/ JSON content.');
  }
  const response = await fetcher(path);
  if (!response.ok) throw new Error(`WebMUGEN stage request failed: HTTP ${response.status}`);
  return parseWebMugenStage(await response.json(), path);
}

export function parseWebMugenStage(value: unknown, sourcePath = '/stages/webmugen/stage.json'): WebMugenStageDefinition {
  if (!isRecord(value) || value.format !== 'webmugen-stage' || value.version !== 1) throw new Error('Not a WebMUGEN stage v1 document.');
  const id = readId(value.id);
  const name = readText(value.name, 'name');
  const presentation = readPresentation(value.presentation);
  const players = isRecord(value.players) ? value.players : {};
  const camera = isRecord(value.camera) ? value.camera : {};
  if (presentation === 'image' && (!Array.isArray(value.layers) || value.layers.length === 0)) throw new Error('Image-based WebMUGEN stage needs at least one image layer.');
  const layers = Array.isArray(value.layers)
    ? value.layers.map((layer, index) => readLayer(layer, sourcePath, index)).sort((a, b) => a.zIndex - b.zIndex)
    : [];
  return {
    format: 'webmugen-stage', version: 1, id, name, presentation,
    groundY: readNumber(value.groundY, -1000, 1000, 'groundY'),
    autoTurn: value.autoTurn !== false,
    players: { p1Start: readPair(players.p1Start, 'p1Start'), p2Start: readPair(players.p2Start, 'p2Start') },
    camera: {
      boundLeft: readNumber(camera.boundLeft, -10000, 0, 'boundLeft'),
      boundRight: readNumber(camera.boundRight, 0, 10000, 'boundRight'),
      boundHigh: readNumber(camera.boundHigh, -10000, 0, 'boundHigh'),
      boundLow: readNumber(camera.boundLow, 0, 10000, 'boundLow'),
      verticalFollow: readNumber(camera.verticalFollow ?? 0.2, 0, 1, 'verticalFollow'),
      tension: readNumber(camera.tension ?? 50, 0, 1000, 'tension'),
    },
    layers,
    sourcePath,
  };
}

function readPresentation(value: unknown): WebMugenStageDefinition['presentation'] {
  return value === 'fresh' || value === 'cyber' || value === 'fresh-clasic' || value === 'cyber-clasic' ? value : 'image';
}

function readLayer(value: unknown, sourcePath: string, index: number): WebMugenStageLayer {
  if (!isRecord(value) || value.type !== 'image') throw new Error(`Layer ${index} is not a supported image layer.`);
  const src = readText(value.src, `layer ${index} src`).replace(/\\/g, '/');
  if (src.includes('..') || src.includes('://') || src.startsWith('/')) throw new Error(`Layer ${index} has an unsafe image source.`);
  const base = sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1);
  const pass = value.pass === 'foreground' ? 'foreground' : 'background';
  const cameraFactor = readCameraFactor(value.cameraFactor, value.parallax, value.parallaxY);
  return {
    type: 'image',
    id: typeof value.id === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value.id) ? value.id : `layer-${index}`,
    src: `${base}${src}`,
    zIndex: readNumber(value.zIndex ?? 0, -10000, 10000, 'zIndex'),
    fit: 'cover',
    cameraFactor,
    viewportBand: readViewportBand(value.viewportBand),
    parallax: cameraFactor[0],
    parallaxY: cameraFactor[1],
    pass,
  };
}

function readViewportBand(value: unknown): [number, number] {
  if (value === undefined) return [0, 1];
  if (!Array.isArray(value) || value.length !== 2) throw new Error('Invalid viewportBand.');
  const start = readNumber(value[0], 0, 1, 'viewportBand start');
  const end = readNumber(value[1], 0, 1, 'viewportBand end');
  if (start >= end) throw new Error('viewportBand start must be below end.');
  return [start, end];
}

function readCameraFactor(value: unknown, legacyX: unknown, legacyY: unknown): [number, number] {
  if (Array.isArray(value) && value.length === 2) {
    return [readNumber(value[0], -2, 2, 'cameraFactor X'), readNumber(value[1], -2, 2, 'cameraFactor Y')];
  }
  return [readNumber(legacyX ?? 0, -2, 2, 'parallax'), readNumber(legacyY ?? 0, -2, 2, 'parallaxY')];
}

function readId(value: unknown): string { const id = readText(value, 'id'); if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) throw new Error('Invalid stage ID.'); return id; }
function readText(value: unknown, field: string): string { const text = typeof value === 'string' ? value.trim() : ''; if (!text || text.length > 160) throw new Error(`Invalid ${field}.`); return text; }
function readNumber(value: unknown, min: number, max: number, field: string): number { const number = Number(value); if (!Number.isFinite(number) || number < min || number > max) throw new Error(`Invalid ${field}.`); return number; }
function readPair(value: unknown, field: string): [number, number] { if (!Array.isArray(value) || value.length !== 2) throw new Error(`Invalid ${field}.`); return [readNumber(value[0], -10000, 10000, field), readNumber(value[1], -10000, 10000, field)]; }
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
