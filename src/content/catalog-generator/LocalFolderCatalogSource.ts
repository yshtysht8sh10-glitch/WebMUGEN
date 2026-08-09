import type { CatalogDirectoryHandle, CatalogSourceFile } from './CatalogGeneratorTypes';

export type CatalogSourceFetch = (path: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

export async function readCatalogSourceFiles(root: CatalogDirectoryHandle): Promise<CatalogSourceFile[]> {
  const files: CatalogSourceFile[] = [];
  await visitDirectory(root, '', files);
  return files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}

export async function readCatalogSourcePath(path: string, fetcher: CatalogSourceFetch = fetch): Promise<CatalogSourceFile> {
  const normalized = path.trim().replace(/\\/g, '/');
  if (!isSafeDirectPath(normalized)) throw new Error('Direct file path must be a same-origin DEF, ZIP, or JSON URL.');
  const response = await fetcher(normalized);
  if (!response.ok) throw new Error(`Direct file request failed: HTTP ${response.status}.`);
  return {
    path: normalized,
    catalogPath: normalized,
    name: normalized.split('/').pop() ?? normalized,
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
}

async function visitDirectory(
  directory: CatalogDirectoryHandle,
  prefix: string,
  output: CatalogSourceFile[],
): Promise<void> {
  for await (const handle of directory.values()) {
    const path = prefix ? `${prefix}/${handle.name}` : handle.name;
    if (handle.kind === 'directory') {
      await visitDirectory(handle, path, output);
      continue;
    }
    if (!isCandidatePath(path)) continue;
    const file = await handle.getFile();
    output.push({ path, name: handle.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  }
}

function isCandidatePath(path: string): boolean {
  return /\.(?:def|zip|json)$/i.test(path) && !/(?:^|\/)catalog\.json$/i.test(path);
}

function isSafeDirectPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://')
    && !path.split('/').some((part) => part === '..' || part === '.') && /\.(?:def|zip|json)$/i.test(path);
}
