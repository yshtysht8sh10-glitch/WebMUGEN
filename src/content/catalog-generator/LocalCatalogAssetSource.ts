import { loadCatalogDirectoryHandle } from './CatalogDirectoryStore';
import type { CatalogDirectoryHandle, CatalogFileHandle } from './CatalogGeneratorTypes';
import { ensureDirectoryPermission } from './CatalogWriter';

const CHARACTER_PUBLIC_BASE = '/chars/';

export async function readLocalCatalogCharacterAsset(path: string): Promise<Uint8Array | null> {
  const relativePath = localCharacterRelativePath(path);
  if (!relativePath) return null;
  const directory = await loadCatalogDirectoryHandle('character');
  if (!directory || !await ensureDirectoryPermission(directory, 'read')) return null;
  return readCatalogDirectoryAsset(directory, relativePath);
}

export async function readCatalogDirectoryAsset(
  root: CatalogDirectoryHandle,
  relativePath: string,
): Promise<Uint8Array | null> {
  const parts = safeRelativeParts(relativePath);
  if (!parts) return null;
  let directory = root;
  for (let index = 0; index < parts.length; index += 1) {
    const handle = await findChild(directory, parts[index]);
    if (!handle) return null;
    if (index === parts.length - 1) {
      if (handle.kind !== 'file') return null;
      const file = await handle.getFile();
      return new Uint8Array(await file.arrayBuffer());
    }
    if (handle.kind !== 'directory') return null;
    directory = handle;
  }
  return null;
}

function localCharacterRelativePath(path: string): string | null {
  const normalized = path.trim().replace(/\\/g, '/');
  if (!normalized.startsWith(CHARACTER_PUBLIC_BASE)) return null;
  const relativePath = normalized.slice(CHARACTER_PUBLIC_BASE.length);
  return relativePath === 'common.cmd' || relativePath === 'common1.cns' ? null : relativePath;
}

function safeRelativeParts(path: string): string[] | null {
  const normalized = path.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return null;
  const parts = normalized.split('/');
  return parts.some((part) => !part || part === '.' || part === '..') ? null : parts;
}

async function findChild(
  directory: CatalogDirectoryHandle,
  name: string,
): Promise<CatalogDirectoryHandle | CatalogFileHandle | null> {
  for await (const handle of directory.values()) {
    if (handle.name === name) return handle;
  }
  return null;
}
