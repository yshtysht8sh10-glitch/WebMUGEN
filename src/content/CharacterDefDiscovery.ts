import { getCharacterDefFiles, getDefSection, getDefValue, parseDefText } from '../parser/def/DefParser';

export type CharacterDefCandidate = {
  path: string;
  name: string;
};

export function inspectCharacterDef(path: string, text: string): CharacterDefCandidate | null {
  const document = parseDefText(text.replace(/^\uFEFF/, ''));
  const files = getCharacterDefFiles(document);
  const hasStateFile = Boolean(files.cns || files.st?.length);
  if (!getDefSection(document, 'Info') || !getDefSection(document, 'Files')) return null;
  if (!files.cmd || !hasStateFile || !files.anim) return null;
  return {
    path,
    name: getDefValue(document, 'Info', 'displayname')
      ?? getDefValue(document, 'Info', 'name')
      ?? fileStem(path),
  };
}

export function discoverCharacterDef(
  entries: Iterable<readonly [string, Uint8Array]>,
  decodeText: (bytes: Uint8Array) => string,
): CharacterDefCandidate {
  const candidates: CharacterDefCandidate[] = [];
  for (const [path, bytes] of entries) {
    if (!path.toLowerCase().endsWith('.def')) continue;
    const candidate = inspectCharacterDef(path, decodeText(bytes));
    if (candidate) candidates.push(candidate);
  }
  if (candidates.length === 0) {
    throw new Error('ZIP contains no valid Character DEF.');
  }
  if (candidates.length > 1) {
    throw new Error(`ZIP contains multiple valid Character DEF files: ${candidates.map((item) => item.path).join(', ')}.`);
  }
  return candidates[0];
}

function fileStem(path: string): string {
  const file = path.replace(/\\/g, '/').split('/').pop() ?? path;
  return file.replace(/\.[^.]+$/, '');
}
