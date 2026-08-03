import type { CatalogDirectoryHandle } from './CatalogGeneratorTypes';

const DATABASE_NAME = 'webmugen.catalog-generator';
const STORE_NAME = 'handles';
const ROOT_KEY = 'content-root';

export async function saveCatalogDirectoryHandle(
  handle: CatalogDirectoryHandle,
  factory: IDBFactory | undefined = readIndexedDb(),
): Promise<boolean> {
  if (!factory) return false;
  const database = await openDatabase(factory);
  try {
    await requestResult(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(handle, ROOT_KEY));
    return true;
  } finally {
    database.close();
  }
}

export async function loadCatalogDirectoryHandle(
  factory: IDBFactory | undefined = readIndexedDb(),
): Promise<CatalogDirectoryHandle | null> {
  if (!factory) return null;
  const database = await openDatabase(factory);
  try {
    return await requestResult(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(ROOT_KEY)) as CatalogDirectoryHandle | null;
  } finally {
    database.close();
  }
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Cannot open the Catalog Generator database.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Catalog Generator storage request failed.'));
  });
}

function readIndexedDb(): IDBFactory | undefined {
  try {
    return typeof indexedDB === 'undefined' ? undefined : indexedDB;
  } catch {
    return undefined;
  }
}
