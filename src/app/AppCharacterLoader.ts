import { unzipSync, strFromU8 } from 'fflate';
import { parseAirText } from '../parser/air/AirParser';
import { parseCmdText } from '../parser/cmd/CmdParser';
import { parseCnsText } from '../parser/cns/CnsParser';
import type { CharacterAssets, CharacterSourceFile } from '../core/character/CharacterTypes';
import { createHttpCharacterAssetFetcher, loadCharacterFromDef, type CharacterAssetFetcher } from '../core/character/CharacterLoader';
import { sampleCharacterAir } from './sampleCharacterAir';
import { sampleCharacterCmd } from './sampleCharacterCmd';
import { sampleCharacterCns } from './sampleCharacterCns';
import { getCharacterDefFiles, getDefValue } from '../parser/def/DefParser';
import type { DefDocument } from '../parser/def/DefTypes';
import { discoverCharacterDef } from '../content/CharacterDefDiscovery';

export type AppCharacterLoadResult = {
  character: CharacterAssets | null;
  source: 'def' | 'sample';
  errorMessage: string | null;
};

export type CharacterRuntimeMetadata = {
  name: string;
  authorName: string;
  palNo: number;
};

export function readCharacterRuntimeMetadata(character: {
  def?: DefDocument;
  palettes?: readonly { slot: number }[];
}, paletteNo = character.palettes?.[0]?.slot ?? 1): CharacterRuntimeMetadata {
  return {
    name: getDefValue(character.def, 'Info', 'name') ?? '',
    authorName: getDefValue(character.def, 'Info', 'author') ?? '',
    palNo: paletteNo,
  };
}

export async function loadAppCharacter(defPath: string, paletteNo = 1): Promise<AppCharacterLoadResult> {
  try {
    const character = defPath.toLowerCase().endsWith('.zip')
      ? await loadCharacterFromZip(defPath, paletteNo)
      : await attachHttpCharacterFileInventory(defPath, await loadCharacterFromDef(defPath, undefined, { paletteNo }));
    return {
      character,
      source: 'def',
      errorMessage: null,
    };
  } catch (error) {
    return {
      character: null,
      source: 'sample',
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createSampleCharacterAssets(): Pick<CharacterAssets, 'cns' | 'air' | 'cmd' | 'sprites' | 'sounds' | 'loadDiagnostics' | 'cnsSourceFiles'> {
  return {
    cns: parseCnsText(sampleCharacterCns, { sourceFile: 'sample.cns' }),
    air: parseAirText(sampleCharacterAir),
    cmd: parseCmdText(sampleCharacterCmd),
    sprites: null,
    sounds: null,
    loadDiagnostics: [],
    cnsSourceFiles: [
      { path: 'sample.cns', label: 'sample.cns', text: sampleCharacterCns, kind: 'cns' },
      { path: 'sample.air', label: 'sample.air', text: sampleCharacterAir, kind: 'air' },
      { path: 'sample.cmd', label: 'sample.cmd', text: sampleCharacterCmd, kind: 'cmd' },
    ],
  };
}

async function loadCharacterFromZip(zipPath: string, paletteNo: number): Promise<CharacterAssets> {
  const fetcher = await createZipCharacterAssetFetcher(zipPath);
  const character = await loadCharacterFromDef(fetcher.defPath, fetcher, { paletteNo });
  return {
    ...character,
    cnsSourceFiles: mergeCharacterFileInventory(
      createZipCharacterFileInventory(zipPath, fetcher, character),
      character.cnsSourceFiles ?? [],
    ),
  };
}

type ZipCharacterAssetFetcher = CharacterAssetFetcher & {
  defPath: string;
  entries: ReadonlyMap<string, Uint8Array>;
};

async function createZipCharacterAssetFetcher(zipPath: string): Promise<ZipCharacterAssetFetcher> {
  const httpFetcher = createHttpCharacterAssetFetcher();
  const entries = unzipSync(new Uint8Array(await httpFetcher.arrayBuffer(zipPath)));
  const normalizedEntries = new Map<string, Uint8Array>();
  const entryKeys = new Map<string, string>();

  for (const [name, bytes] of Object.entries(entries)) {
    if (name.endsWith('/')) continue;
    const normalized = normalizeZipPath(name);
    if (!normalized) continue;
    const key = archiveLookupKey(normalized);
    if (entryKeys.has(key)) {
      throw new Error(`ZIP contains case-insensitive duplicate paths: ${entryKeys.get(key)}, ${normalized}.`);
    }
    entryKeys.set(key, normalized);
    normalizedEntries.set(normalized, bytes);
  }

  const defPath = discoverCharacterDef(normalizedEntries, decodeZipText).path;

  const archiveEntry = (path: string): Uint8Array | undefined => {
    const normalized = normalizeZipPath(path);
    return normalized ? normalizedEntries.get(entryKeys.get(archiveLookupKey(normalized)) ?? '') : undefined;
  };

  return {
    defPath,
    entries: normalizedEntries,
    async text(path: string) {
      const entry = archiveEntry(path);
      if (entry) return decodeZipText(entry);
      if (isSharedHttpAssetPath(path)) return httpFetcher.text(path);
      throw new Error(`ZIP text asset not found: ${path}`);
    },
    async arrayBuffer(path: string) {
      const entry = archiveEntry(path);
      if (entry) return toArrayBuffer(entry);
      if (isSharedHttpAssetPath(path)) return httpFetcher.arrayBuffer(path);
      throw new Error(`ZIP binary asset not found: ${path}`);
    },
  };
}

export async function saveCharacterSourceFile(file: CharacterSourceFile, text: string): Promise<void> {
  if (!file.editable) throw new Error('This file is not editable text.');
  const response = await fetch('/__webmugen/character-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: file.path,
      text,
      archivePath: file.archivePath,
      archiveEntryPath: file.archiveEntryPath,
    }),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? `Save failed: HTTP ${response.status}`);
}

async function attachHttpCharacterFileInventory(defPath: string, character: CharacterAssets): Promise<CharacterAssets> {
  try {
    const response = await fetch(`/__webmugen/character-files?defPath=${encodeURIComponent(defPath)}`);
    if (!response.ok) return enrichKnownCharacterFiles(defPath, character);
    const payload = await response.json() as {
      files?: Array<{ path: string; label: string; text: string; binaryBase64?: string }>;
    };
    const files = (payload.files ?? []).map((file) => createCharacterSourceFile({
      path: file.path,
      label: file.label,
      text: file.text,
      binary: file.binaryBase64 ? decodeBase64(file.binaryBase64) : undefined,
      external: false,
      primary: isPrimarySpritePath(defPath, character, file.path),
    }));
    return {
      ...character,
      cnsSourceFiles: mergeCharacterFileInventory(files, character.cnsSourceFiles ?? [], defPath),
    };
  } catch {
    return enrichKnownCharacterFiles(defPath, character);
  }
}

function createZipCharacterFileInventory(
  zipPath: string,
  fetcher: ZipCharacterAssetFetcher,
  character: CharacterAssets,
): CharacterSourceFile[] {
  const characterRoot = directoryOf(fetcher.defPath);
  return Array.from(fetcher.entries, ([path, bytes]) => {
    const text = isProbablyText(bytes) ? decodeZipText(bytes) : '';
    return createCharacterSourceFile({
      path,
      label: relativeInventoryPath(path, characterRoot),
      text,
      binary: ['sff', 'snd', 'act'].includes(extensionOf(path)) ? new Uint8Array(bytes) : undefined,
      external: !isInsideDirectory(path, characterRoot),
      primary: isPrimarySpritePath(fetcher.defPath, character, path),
      archivePath: zipPath,
      archiveEntryPath: path,
    });
  }).sort(compareCharacterFiles);
}

function enrichKnownCharacterFiles(defPath: string, character: CharacterAssets): CharacterAssets {
  const root = directoryOf(defPath);
  return {
    ...character,
    cnsSourceFiles: (character.cnsSourceFiles ?? []).map((file) => ({
      ...file,
      editable: file.text.length > 0,
      external: !isInsideDirectory(file.path, root),
      primary: isPrimarySpritePath(defPath, character, file.path),
    })),
  };
}

function mergeCharacterFileInventory(
  inventory: readonly CharacterSourceFile[],
  loadedFiles: readonly CharacterSourceFile[],
  defPath?: string,
): CharacterSourceFile[] {
  const files = new Map(inventory.map((file) => [normalizeInventoryPath(file.path), file]));
  for (const loaded of loadedFiles) {
    const key = normalizeInventoryPath(loaded.path);
    const inventoried = files.get(key);
    files.set(key, createCharacterSourceFile({
      ...inventoried,
      ...loaded,
      label: inventoried?.label ?? loaded.label,
      binary: inventoried?.binary,
      editable: true,
      external: inventoried?.external ?? (defPath ? !isInsideDirectory(loaded.path, directoryOf(defPath)) : loaded.kind === 'common'),
      primary: inventoried?.primary,
      archivePath: inventoried?.archivePath,
      archiveEntryPath: inventoried?.archiveEntryPath,
    }));
  }
  return Array.from(files.values()).sort(compareCharacterFiles);
}

function createCharacterSourceFile(file: CharacterSourceFile): CharacterSourceFile {
  const kind = file.kind ?? classifyCharacterFile(file.path, file.text);
  return {
    ...file,
    kind,
    editable: file.editable ?? isTextKind(kind, file.text),
  };
}

function classifyCharacterFile(path: string, text: string): CharacterSourceFile['kind'] {
  const extension = extensionOf(path);
  if (extension === 'def') return 'def';
  if (extension === 'cns') return 'cns';
  if (extension === 'cmd') return 'cmd';
  if (extension === 'air') return 'air';
  if (extension === 'zss') return 'zss';
  if (extension === 'sff') return 'sff';
  if (extension === 'snd') return 'snd';
  if (extension === 'act') return 'act';
  return text.length > 0 || extension === 'txt' ? 'text' : 'binary';
}

function isTextKind(kind: CharacterSourceFile['kind'], text: string): boolean {
  return kind === 'def' || kind === 'cns' || kind === 'cmd' || kind === 'air' || kind === 'zss' || kind === 'common' || kind === 'text' || text.length > 0;
}

function isPrimarySpritePath(defPath: string, character: CharacterAssets, candidatePath: string): boolean {
  const sprite = getCharacterDefFiles(character.def).sprite;
  if (!sprite) return false;
  const resolved = normalizeInventoryPath(`${directoryOf(defPath)}/${sprite}`);
  return normalizeInventoryPath(candidatePath) === resolved;
}

function isInsideDirectory(path: string, directory: string): boolean {
  const normalizedPath = normalizeInventoryPath(path);
  const normalizedDirectory = normalizeInventoryPath(directory).replace(/\/$/, '');
  return normalizedPath === normalizedDirectory || normalizedPath.startsWith(`${normalizedDirectory}/`);
}

function normalizeInventoryPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/').toLowerCase();
}

function directoryOf(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const slash = normalized.lastIndexOf('/');
  return slash >= 0 ? normalized.slice(0, slash) : '';
}

function extensionOf(path: string): string {
  return path.toLowerCase().split('.').pop() ?? '';
}

function shortLabel(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function relativeInventoryPath(path: string, directory: string): string {
  const normalizedPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
  const normalizedDirectory = directory.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalizedDirectory) return normalizedPath;
  return normalizedPath.toLowerCase().startsWith(`${normalizedDirectory.toLowerCase()}/`)
    ? normalizedPath.slice(normalizedDirectory.length + 1)
    : shortLabel(path);
}

function isProbablyText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let controls = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) controls += 1;
  }
  return controls / sample.length < 0.02;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function compareCharacterFiles(left: CharacterSourceFile, right: CharacterSourceFile): number {
  if (left.external !== right.external) return left.external ? 1 : -1;
  return left.path.localeCompare(right.path, 'en');
}

function normalizeZipPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) throw new Error(`ZIP path escapes the archive root: ${path}`);
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/');
}

function archiveLookupKey(path: string): string {
  return path.toLowerCase();
}

function isSharedHttpAssetPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return normalized === '/chars/common1.cns' || normalized === '/chars/common.cmd';
}

function decodeZipText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('shift_jis').decode(bytes);
  } catch {
    return strFromU8(bytes);
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}
