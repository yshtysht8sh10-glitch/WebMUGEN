import { strToU8, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { loadCatalogDirectoryHandle, saveCatalogDirectoryHandle } from './CatalogDirectoryStore';
import { classifyDefText, classifyWebMugenJson, classifyZipBytes } from './CatalogContentClassifier';
import { generateContentCatalog } from './CatalogGenerator';
import type { CatalogDirectoryHandle, CatalogFileHandle, CatalogSourceFile } from './CatalogGeneratorTypes';
import { readCatalogSourceFiles } from './LocalFolderCatalogSource';
import { downloadCatalogJson, ensureDirectoryPermission, serializeContentCatalog, writeCatalogToDirectory } from './CatalogWriter';

const characterDef = '[Info]\nname = Hero\n[Files]\ncmd = hero.cmd\ncns = hero.cns\nsprite = hero.sff\nanim = hero.air';
const stageDef = '[StageInfo]\nname = Arena\n[Camera]\n[PlayerInfo]\n[Bound]\n[BGDef]';
const lifeBarDef = '[Files]\nsff = fight.sff\nsnd = fight.snd\n[Lifebar]\n[Powerbar]\n[Round]';
const nativeStage = { format: 'webmugen-stage', version: 1, id: 'cyber', name: 'Cyber', presentation: 'cyber-clasic', groundY: 0, players: { p1Start: [-70, 0], p2Start: [70, 0] }, camera: { boundLeft: -400, boundRight: 400, boundHigh: -120, boundLow: 0, verticalFollow: 0.2, tension: 50 } };
const nativeLifeBar = { format: 'webmugen-lifebar', version: 1, id: 'native', name: 'Native HUD', layout: 'responsive' };

describe('Catalog Generator classification', () => {
  it('classifies Character, Stage, LifeBar, and WebMUGEN JSON definitions with structured results', () => {
    expect(classifyDefText(characterDef, 'hero.def')).toMatchObject({ kind: 'character', engine: 'winmugen', name: 'Hero', errors: [] });
    expect(classifyDefText(stageDef, 'arena.def')).toMatchObject({ kind: 'stage', engine: 'winmugen', errors: [] });
    expect(classifyDefText(lifeBarDef, 'fight.def')).toMatchObject({ kind: 'lifebar', engine: 'winmugen', errors: [] });
    expect(classifyWebMugenJson(JSON.stringify(nativeStage), 'stage.json'))
      .toMatchObject({ kind: 'stage', engine: 'webmugen', name: 'Cyber' });
  });

  it('classifies one ZIP entry and rejects corrupt or ambiguous ZIP archives', () => {
    expect(classifyZipBytes(zipSync({ 'hero/hero.def': strToU8(characterDef) }), 'hero.zip'))
      .toMatchObject({ kind: 'character', engine: 'winmugen', entryFile: 'hero/hero.def' });
    expect(classifyZipBytes(new Uint8Array([1, 2, 3]), 'broken.zip')).toMatchObject({ kind: 'unknown' });
    const ambiguous = classifyZipBytes(zipSync({ 'hero.def': strToU8(characterDef), 'arena.def': strToU8(stageDef) }), 'mixed.zip');
    expect(ambiguous.kind).toBe('unknown');
    expect(ambiguous.errors[0]).toContain('multiple recognized entry DEF');
  });

  it('generates Catalog JSON, rejects unknown and duplicate IDs, and reports changes from an existing Catalog', () => {
    const files: CatalogSourceFile[] = [
      sourceFile('chars/hero.def', characterDef),
      { path: 'archives/hero.zip', name: 'hero.zip', bytes: zipSync({ 'hero.def': strToU8(characterDef) }) },
      sourceFile('stages/arena.def', stageDef),
      sourceFile('notes/unknown.def', '[Info]\nname=x'),
      sourceFile('../escape.def', stageDef),
      sourceFile('lifebars/native.json', JSON.stringify(nativeLifeBar)),
    ];
    const result = generateContentCatalog(files, { version: 1, items: [
      { id: 'old', name: 'Old', kind: 'stage', engine: 'winmugen', path: 'old.def' },
      { id: 'arena', name: 'Old Arena', kind: 'stage', engine: 'winmugen', path: 'stages/arena.def' },
    ] });
    expect(result.catalog.items.map((item) => item.id)).toEqual(['hero', 'arena', 'native']);
    expect(result.excluded.map((item) => item.path)).toEqual(['archives/hero.zip', 'notes/unknown.def', '../escape.def']);
    expect(result.errors[0]).toContain('Duplicate generated ID');
    expect(result.errors[1]).toContain('Unsafe generated path');
    expect(result.diff).toEqual({ added: ['hero', 'native'], removed: ['old'], changed: ['arena'] });
    expect(JSON.parse(serializeContentCatalog(result.catalog))).toEqual(result.catalog);
  });
});

describe('Catalog Generator folder and permission support', () => {
  it('recursively scans supported candidate files while excluding the existing catalog.json', async () => {
    const nested = directory('chars', [file('hero.def', characterDef), file('readme.txt', 'ignored')]);
    const root = directory('content', [nested, file('catalog.json', '{}'), file('arena.def', stageDef)]);
    expect((await readCatalogSourceFiles(root)).map((entry) => entry.path)).toEqual(['arena.def', 'chars/hero.def']);
  });

  it('requests expired permissions, writes when granted, and reports denied write access', async () => {
    const write = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const granted = directory('content', []);
    granted.queryPermission = vi.fn(async (): Promise<PermissionState> => 'prompt');
    granted.requestPermission = vi.fn(async (): Promise<PermissionState> => 'granted');
    granted.getFileHandle = vi.fn(async () => ({ createWritable: async () => ({ write, close }) }));
    expect(await ensureDirectoryPermission(granted, 'readwrite')).toBe(true);
    expect(await writeCatalogToDirectory(granted, { version: 1, items: [] })).toBe('written');
    expect(write).toHaveBeenCalledWith('{\n  "version": 1,\n  "items": []\n}\n');

    const denied = directory('content', []);
    denied.queryPermission = vi.fn(async (): Promise<PermissionState> => 'denied');
    denied.requestPermission = vi.fn(async (): Promise<PermissionState> => 'denied');
    denied.getFileHandle = vi.fn();
    expect(await writeCatalogToDirectory(denied, { version: 1, items: [] })).toBe('permission-denied');
    expect(denied.getFileHandle).not.toHaveBeenCalled();
  });

  it('downloads generated JSON when direct folder write is unavailable', () => {
    const click = vi.fn();
    const revokeObjectURL = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:catalog');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    downloadCatalogJson({ version: 1, items: [] }, { createElement: () => ({ href: '', download: '', click }) } as unknown as Document);
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:catalog');
    vi.unstubAllGlobals();
  });

  it('persists and restores a DirectoryHandle through the IndexedDB adapter and degrades safely without it', async () => {
    const root = directory('content', []);
    const factory = createMemoryIdbFactory();
    expect(await saveCatalogDirectoryHandle(root, factory)).toBe(true);
    expect(await loadCatalogDirectoryHandle(factory)).toBe(root);
    expect(await saveCatalogDirectoryHandle(root, undefined)).toBe(false);
    expect(await loadCatalogDirectoryHandle(undefined)).toBeNull();
  });
});

function sourceFile(path: string, text: string): CatalogSourceFile {
  return { path, name: path.split('/').pop()!, bytes: strToU8(text) };
}

function file(name: string, text: string): CatalogFileHandle {
  const bytes = strToU8(text);
  return { kind: 'file', name, getFile: async () => ({ arrayBuffer: async () => bytes.slice().buffer }) };
}

function directory(name: string, handles: Array<CatalogFileHandle | CatalogDirectoryHandle>): CatalogDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async *values() { for (const handle of handles) yield handle; },
  };
}

function createMemoryIdbFactory(): IDBFactory {
  let stored: unknown;
  const objectStore = {
    put(value: unknown) { stored = value; return completeRequest('content-root'); },
    get() { return completeRequest(stored ?? null); },
  };
  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => objectStore,
    transaction: () => ({ objectStore: () => objectStore }),
    close: () => undefined,
  };
  return {
    open() {
      const request: Record<string, any> = { result: database };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  } as unknown as IDBFactory;
}

function completeRequest<T>(value: T): IDBRequest<T> {
  const request: Record<string, any> = { result: value };
  queueMicrotask(() => request.onsuccess?.());
  return request as IDBRequest<T>;
}
