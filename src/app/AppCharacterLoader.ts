import { unzipSync, strFromU8 } from 'fflate';
import { parseAirText } from '../parser/air/AirParser';
import { parseCmdText } from '../parser/cmd/CmdParser';
import { parseCnsText } from '../parser/cns/CnsParser';
import type { CharacterAssets } from '../core/character/CharacterTypes';
import { createHttpCharacterAssetFetcher, loadCharacterFromDef, type CharacterAssetFetcher } from '../core/character/CharacterLoader';
import { sampleCharacterAir } from './sampleCharacterAir';
import { sampleCharacterCmd } from './sampleCharacterCmd';
import { sampleCharacterCns } from './sampleCharacterCns';
import { getDefValue } from '../parser/def/DefParser';
import type { DefDocument } from '../parser/def/DefTypes';

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
}): CharacterRuntimeMetadata {
  return {
    name: getDefValue(character.def, 'Info', 'name') ?? '',
    authorName: getDefValue(character.def, 'Info', 'author') ?? '',
    palNo: character.palettes?.[0]?.slot ?? 1,
  };
}

export async function loadAppCharacter(defPath: string): Promise<AppCharacterLoadResult> {
  try {
    const character = defPath.toLowerCase().endsWith('.zip')
      ? await loadCharacterFromZip(defPath)
      : await loadCharacterFromDef(defPath);
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

async function loadCharacterFromZip(zipPath: string): Promise<CharacterAssets> {
  const fetcher = await createZipCharacterAssetFetcher(zipPath);
  return loadCharacterFromDef(fetcher.defPath, fetcher);
}

type ZipCharacterAssetFetcher = CharacterAssetFetcher & {
  defPath: string;
};

async function createZipCharacterAssetFetcher(zipPath: string): Promise<ZipCharacterAssetFetcher> {
  const httpFetcher = createHttpCharacterAssetFetcher();
  const entries = unzipSync(new Uint8Array(await httpFetcher.arrayBuffer(zipPath)));
  const normalizedEntries = new Map<string, Uint8Array>();

  for (const [name, bytes] of Object.entries(entries)) {
    if (name.endsWith('/')) continue;
    normalizedEntries.set(normalizeZipPath(name), bytes);
  }

  const defPath = findPrimaryDefPath(normalizedEntries);

  return {
    defPath,
    async text(path: string) {
      const entry = normalizedEntries.get(normalizeZipPath(path));
      if (entry) return decodeZipText(entry);
      return httpFetcher.text(path);
    },
    async arrayBuffer(path: string) {
      const entry = normalizedEntries.get(normalizeZipPath(path));
      if (entry) return toArrayBuffer(entry);
      return httpFetcher.arrayBuffer(path);
    },
  };
}

function findPrimaryDefPath(entries: ReadonlyMap<string, Uint8Array>): string {
  const defPaths = Array.from(entries.keys()).filter((path) => path.toLowerCase().endsWith('.def'));
  if (defPaths.length === 0) {
    throw new Error('ZIP character has no .def file.');
  }

  const rootName = commonRootName(defPaths);
  return defPaths.find((path) => fileStem(path).toLowerCase() === rootName.toLowerCase()) ?? defPaths[0];
}

function commonRootName(paths: readonly string[]): string {
  const first = paths[0]?.split('/')[0] ?? '';
  return first && paths.every((path) => path.startsWith(`${first}/`)) ? first : fileStem(paths[0] ?? '');
}

function fileStem(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.[^.]+$/, '');
}

function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '');
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
