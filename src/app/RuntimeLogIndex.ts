import type { GameState } from '../core/engine/types';

export const RUNTIME_LOG_INDEX_STORE_LIMIT = 5000;
export const RUNTIME_LOG_INDEX_VISIBLE_LIMIT = 200;

export type RuntimeLogIndexEntry = {
  id: number;
  frameNo: number;
  timestamp: string;
  p1StateNo: number;
  p1AnimNo: number;
  p2StateNo: number;
  p2AnimNo: number;
};

export type ReadableRuntimeEntry = {
  id: number;
  frameNo: number;
  lines: string[];
};

export function createRuntimeLogIndexEntry({
  id,
  frameNo,
  timestamp,
  state,
}: {
  id: number;
  frameNo: number;
  timestamp: string;
  state: GameState;
}): RuntimeLogIndexEntry {
  const [p1, p2] = state.players;
  return {
    id,
    frameNo,
    timestamp,
    p1StateNo: p1?.stateNo ?? -1,
    p1AnimNo: p1?.animNo ?? -1,
    p2StateNo: p2?.stateNo ?? -1,
    p2AnimNo: p2?.animNo ?? -1,
  };
}

export function appendReadableRuntimeEntry({
  indexStore,
  entryStore,
  indexEntry,
  entry,
  storeLimit = RUNTIME_LOG_INDEX_STORE_LIMIT,
  visibleLimit = RUNTIME_LOG_INDEX_VISIBLE_LIMIT,
}: {
  indexStore: RuntimeLogIndexEntry[];
  entryStore: Map<number, ReadableRuntimeEntry>;
  indexEntry: RuntimeLogIndexEntry;
  entry: ReadableRuntimeEntry;
  storeLimit?: number;
  visibleLimit?: number;
}): RuntimeLogIndexEntry[] {
  entryStore.set(entry.frameNo, entry);
  indexStore.push(indexEntry);

  while (indexStore.length > storeLimit) {
    const removed = indexStore.shift();
    if (removed) entryStore.delete(removed.frameNo);
  }

  return getVisibleRuntimeLogIndex(indexStore, visibleLimit);
}

export function getVisibleRuntimeLogIndex(
  indexStore: readonly RuntimeLogIndexEntry[],
  visibleLimit = RUNTIME_LOG_INDEX_VISIBLE_LIMIT,
): RuntimeLogIndexEntry[] {
  return indexStore.slice(Math.max(0, indexStore.length - visibleLimit));
}

export function getReadableRuntimeEntry(
  entryStore: ReadonlyMap<number, ReadableRuntimeEntry>,
  frameNo: number,
): ReadableRuntimeEntry | null {
  return entryStore.get(frameNo) ?? null;
}

export function getLatestReadableRuntimeEntry({
  indexStore,
  entryStore,
}: {
  indexStore: readonly RuntimeLogIndexEntry[];
  entryStore: ReadonlyMap<number, ReadableRuntimeEntry>;
}): ReadableRuntimeEntry | null {
  for (let index = indexStore.length - 1; index >= 0; index -= 1) {
    const entry = entryStore.get(indexStore[index].frameNo);
    if (entry) return entry;
  }
  return null;
}

export function formatReadableRuntimeEntryCopy(entry: ReadableRuntimeEntry | null): string {
  return entry ? entry.lines.join('\n') : 'selected frame=-';
}

export function formatAllReadableRuntimeEntriesCopy({
  indexStore,
  entryStore,
}: {
  indexStore: readonly RuntimeLogIndexEntry[];
  entryStore: ReadonlyMap<number, ReadableRuntimeEntry>;
}): string {
  return indexStore
    .map((indexEntry) => entryStore.get(indexEntry.frameNo))
    .filter((entry): entry is ReadableRuntimeEntry => Boolean(entry))
    .map((entry) => entry.lines.join('\n'))
    .join('\n');
}

export function clearReadableRuntimeLogStores({
  indexStore,
  entryStore,
}: {
  indexStore: RuntimeLogIndexEntry[];
  entryStore: Map<number, ReadableRuntimeEntry>;
}): RuntimeLogIndexEntry[] {
  indexStore.length = 0;
  entryStore.clear();
  return [];
}
