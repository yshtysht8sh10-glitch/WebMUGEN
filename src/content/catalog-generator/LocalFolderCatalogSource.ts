import type { CatalogDirectoryHandle, CatalogSourceFile } from './CatalogGeneratorTypes';

export async function readCatalogSourceFiles(root: CatalogDirectoryHandle): Promise<CatalogSourceFile[]> {
  const files: CatalogSourceFile[] = [];
  await visitDirectory(root, '', files);
  return files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
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
