import { unzipSync } from 'fflate';
import { parseWebMugenLifeBar } from '../../lifebar/webmugen/WebMugenLifeBarLoader';
import { parseWebMugenStage } from '../../stage/webmugen/WebMugenStageLoader';
import type { ContentKind } from '../catalog/ContentCatalogTypes';
import type { CatalogClassificationResult, CatalogSourceFile } from './CatalogGeneratorTypes';

type ParsedDef = {
  sections: Map<string, Map<string, string>>;
  name?: string;
};

export function classifyDefText(text: string, entryFile = 'content.def'): CatalogClassificationResult {
  const parsed = parseDef(text);
  const sections = parsed.sections;
  const files = sections.get('files');
  const characterEvidence = Boolean(
    sections.has('info') && files
    && (files.has('cmd') || files.has('cns') || [...files.keys()].some((key) => /^st\d*$/.test(key)))
    && (files.has('sprite') || files.has('anim')),
  );
  const stageEvidence = (sections.has('info') || sections.has('stageinfo'))
    && sections.has('camera') && sections.has('playerinfo') && sections.has('bound') && sections.has('bgdef');
  const lifeBarSections = ['lifebar', 'powerbar', 'face', 'name', 'winicon', 'time', 'combo', 'round'];
  const lifeBarEvidence = Boolean(files && lifeBarSections.filter((section) => sections.has(section)).length >= 2);
  const detected = [characterEvidence && 'character', stageEvidence && 'stage', lifeBarEvidence && 'lifebar']
    .filter(Boolean) as ContentKind[];
  if (detected.length !== 1) {
    return unknownResult(entryFile, detected.length > 1
      ? `DEF matches multiple content kinds: ${detected.join(', ')}.`
      : 'DEF does not contain a complete Character, Stage, or LifeBar structure.');
  }
  return {
    kind: detected[0],
    engine: 'winmugen',
    confidence: 1,
    entryFile,
    ...(parsed.name ? { name: parsed.name } : {}),
    warnings: [],
    errors: [],
  };
}

export function classifyZipBytes(bytes: Uint8Array, entryFile = 'content.zip'): CatalogClassificationResult {
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(bytes);
  } catch (error) {
    return unknownResult(entryFile, `ZIP is corrupt or unsupported: ${error instanceof Error ? error.message : String(error)}`);
  }
  const candidates: CatalogClassificationResult[] = [];
  for (const [path, content] of Object.entries(archive)) {
    if (!path.toLowerCase().endsWith('.def') || path.endsWith('/')) continue;
    const result = classifyDefText(decodeText(content), path);
    if (result.kind !== 'unknown') candidates.push(result);
  }
  if (candidates.length === 0) return unknownResult(entryFile, 'ZIP contains no recognized entry DEF.');
  if (candidates.length > 1) {
    return unknownResult(entryFile, `ZIP contains multiple recognized entry DEF files: ${candidates.map((item) => item.entryFile).join(', ')}.`);
  }
  return { ...candidates[0], entryFile: candidates[0].entryFile, warnings: [] };
}

export function classifyWebMugenJson(text: string, entryFile: string): CatalogClassificationResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return unknownResult(entryFile, `JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(value)) return unknownResult(entryFile, 'JSON root must be an object.');
  const format = value.format;
  const kind = format === 'webmugen-stage' ? 'stage' : format === 'webmugen-lifebar' ? 'lifebar' : null;
  if (!kind) return unknownResult(entryFile, 'JSON is not a WebMUGEN Stage or LifeBar definition.');
  try {
    if (kind === 'stage') parseWebMugenStage(value, `/${entryFile}`);
    else parseWebMugenLifeBar(value, `/${entryFile}`);
  } catch (error) {
    return unknownResult(entryFile, `Invalid WebMUGEN ${kind}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    kind,
    engine: 'webmugen',
    confidence: 1,
    entryFile,
    ...(typeof value.name === 'string' && value.name.trim() ? { name: value.name.trim() } : {}),
    warnings: [],
    errors: [],
  };
}

export function classifyCatalogSourceFile(file: CatalogSourceFile): CatalogClassificationResult {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.zip')) return classifyZipBytes(file.bytes, file.path);
  if (lower.endsWith('.def')) return classifyDefText(decodeText(file.bytes), file.path);
  if (lower.endsWith('.json') && lower !== 'catalog.json') return classifyWebMugenJson(decodeText(file.bytes), file.path);
  return unknownResult(file.path, 'File type is not a supported Catalog entry candidate.');
}

function parseDef(text: string): ParsedDef {
  const sections = new Map<string, Map<string, string>>();
  let current: Map<string, string> | undefined;
  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.replace(/;.*/, '').trim();
    const section = line.match(/^\[([^\]]+)]$/);
    if (section) {
      const name = section[1].trim().toLowerCase();
      current = sections.get(name) ?? new Map<string, string>();
      sections.set(name, current);
      continue;
    }
    const assignment = line.match(/^([^=]+)=(.*)$/);
    if (current && assignment) current.set(assignment[1].trim().toLowerCase(), unquote(assignment[2].trim()));
  }
  const name = sections.get('info')?.get('name');
  return { sections, ...(name ? { name } : {}) };
}

function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (!utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('shift-jis', { fatal: false }).decode(bytes);
  } catch {
    return utf8;
  }
}

function unknownResult(entryFile: string, error: string): CatalogClassificationResult {
  return { kind: 'unknown', confidence: 0, entryFile, warnings: [], errors: [error] };
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
