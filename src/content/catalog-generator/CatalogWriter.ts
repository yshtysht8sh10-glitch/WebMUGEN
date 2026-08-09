import type { ContentCatalogDocument } from '../catalog/ContentCatalogTypes';
import type { CatalogDirectoryHandle } from './CatalogGeneratorTypes';

export function serializeContentCatalog(catalog: ContentCatalogDocument): string {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

export async function ensureDirectoryPermission(
  directory: CatalogDirectoryHandle,
  mode: 'read' | 'readwrite',
): Promise<boolean> {
  if (!directory.queryPermission) return mode === 'read';
  if (await directory.queryPermission({ mode }) === 'granted') return true;
  return directory.requestPermission ? await directory.requestPermission({ mode }) === 'granted' : false;
}

export async function writeCatalogToDirectory(
  directory: CatalogDirectoryHandle,
  catalog: ContentCatalogDocument,
): Promise<'written' | 'permission-denied' | 'unsupported'> {
  if (!directory.getFileHandle) return 'unsupported';
  if (!await ensureDirectoryPermission(directory, 'readwrite')) return 'permission-denied';
  const file = await directory.getFileHandle('catalog.json', { create: true });
  const writable = await file.createWritable();
  await writable.write(serializeContentCatalog(catalog));
  await writable.close();
  return 'written';
}

export function downloadCatalogJson(catalog: ContentCatalogDocument, documentRef: Document = document): void {
  const url = URL.createObjectURL(new Blob([serializeContentCatalog(catalog)], { type: 'application/json' }));
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = 'catalog.json';
  anchor.click();
  URL.revokeObjectURL(url);
}
