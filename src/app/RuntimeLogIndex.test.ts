import { describe, expect, it } from 'vitest';
import {
  appendReadableRuntimeEntry,
  clearReadableRuntimeLogStores,
  formatAllReadableRuntimeEntriesCopy,
  getLatestReadableRuntimeEntry,
  getReadableRuntimeEntry,
  type ReadableRuntimeEntry,
  type RuntimeLogIndexEntry,
} from './RuntimeLogIndex';

function indexEntry(id: number, frameNo: number, stateNo = 50): RuntimeLogIndexEntry {
  return {
    id,
    key: `${frameNo}:${stateNo}`,
    frameNo,
    timestamp: '12:00:00',
    p1StateNo: stateNo,
    p1AnimNo: 41,
    p2StateNo: 0,
    p2AnimNo: 0,
  };
}

function readableEntry(id: number, frameNo: number, p1StateNo = 50): ReadableRuntimeEntry {
  return {
    id,
    key: `${frameNo}:${p1StateNo}`,
    frameNo,
    p1StateNo,
    lines: [`---- 12:00:00 frame=${frameNo} ----`, `detail ${frameNo}`],
  };
}

function readableEntryForState(id: number, frameNo: number, p1StateNo: number): ReadableRuntimeEntry {
  return {
    id,
    key: `${frameNo}:${p1StateNo}`,
    frameNo,
    p1StateNo,
    lines: [`---- 12:00:00 frame=${frameNo} state=${p1StateNo} ----`, `detail ${frameNo}:${p1StateNo}`],
  };
}

describe('RuntimeLogIndex', () => {
  it('adds index entries even when StateNo does not change', () => {
    const indexStore: RuntimeLogIndexEntry[] = [];
    const entryStore = new Map<string, ReadableRuntimeEntry>();

    appendReadableRuntimeEntry({ indexStore, entryStore, indexEntry: indexEntry(1, 100, 50), entry: readableEntry(1, 100) });
    const visible = appendReadableRuntimeEntry({ indexStore, entryStore, indexEntry: indexEntry(2, 101, 50), entry: readableEntry(2, 101) });

    expect(visible.map((entry) => entry.frameNo)).toEqual([100, 101]);
    expect(visible.every((entry) => entry.p1StateNo === 50)).toBe(true);
  });

  it('loads the clicked frame detail from the store', () => {
    const indexStore: RuntimeLogIndexEntry[] = [];
    const entryStore = new Map<string, ReadableRuntimeEntry>();

    appendReadableRuntimeEntry({ indexStore, entryStore, indexEntry: indexEntry(1, 1569), entry: readableEntry(1, 1569) });
    appendReadableRuntimeEntry({ indexStore, entryStore, indexEntry: indexEntry(2, 1570), entry: readableEntry(2, 1570) });

    expect(getReadableRuntimeEntry(entryStore, 1570, 50)?.lines.join('\n')).toContain('detail 1570');
  });

  it('keeps the selected older detail stable after newer logs are appended', () => {
    const indexStore: RuntimeLogIndexEntry[] = [];
    const entryStore = new Map<string, ReadableRuntimeEntry>();

    appendReadableRuntimeEntry({ indexStore, entryStore, indexEntry: indexEntry(1, 10), entry: readableEntry(1, 10) });
    const selected = getReadableRuntimeEntry(entryStore, 10, 50);
    appendReadableRuntimeEntry({ indexStore, entryStore, indexEntry: indexEntry(2, 11), entry: readableEntry(2, 11) });

    expect(selected?.frameNo).toBe(10);
    expect(selected?.lines.join('\n')).toContain('detail 10');
  });

  it('returns the latest frame on demand', () => {
    const indexStore: RuntimeLogIndexEntry[] = [];
    const entryStore = new Map<string, ReadableRuntimeEntry>();

    appendReadableRuntimeEntry({ indexStore, entryStore, indexEntry: indexEntry(1, 20), entry: readableEntry(1, 20) });
    appendReadableRuntimeEntry({ indexStore, entryStore, indexEntry: indexEntry(2, 21), entry: readableEntry(2, 21) });

    expect(getLatestReadableRuntimeEntry({ indexStore, entryStore })?.frameNo).toBe(21);
  });

  it('limits visible entries separately from the internal store', () => {
    const indexStore: RuntimeLogIndexEntry[] = [];
    const entryStore = new Map<string, ReadableRuntimeEntry>();
    let visible: RuntimeLogIndexEntry[] = [];

    for (let frameNo = 1; frameNo <= 5; frameNo += 1) {
      visible = appendReadableRuntimeEntry({
        indexStore,
        entryStore,
        indexEntry: indexEntry(frameNo, frameNo),
        entry: readableEntry(frameNo, frameNo, frameNo),
        storeLimit: 10,
        visibleLimit: 2,
      });
    }

    expect(visible.map((entry) => entry.frameNo)).toEqual([4, 5]);
    expect(getReadableRuntimeEntry(entryStore, 2, 2)?.frameNo).toBe(2);
  });

  it('keeps multiple StateNo details for the same frame', () => {
    const indexStore: RuntimeLogIndexEntry[] = [];
    const entryStore = new Map<string, ReadableRuntimeEntry>();

    appendReadableRuntimeEntry({
      indexStore,
      entryStore,
      indexEntry: indexEntry(1, 100, 101),
      entry: readableEntryForState(1, 100, 101),
    });
    const visible = appendReadableRuntimeEntry({
      indexStore,
      entryStore,
      indexEntry: indexEntry(2, 100, 20),
      entry: readableEntryForState(2, 100, 20),
    });

    expect(visible.map((entry) => entry.key)).toEqual(['100:101', '100:20']);
    expect(getReadableRuntimeEntry(entryStore, 100, 101)?.lines.join('\n')).toContain('detail 100:101');
    expect(getReadableRuntimeEntry(entryStore, 100, 20)?.lines.join('\n')).toContain('detail 100:20');
  });

  it('formats all readable entries from the retained store', () => {
    const indexStore: RuntimeLogIndexEntry[] = [];
    const entryStore = new Map<string, ReadableRuntimeEntry>();

    appendReadableRuntimeEntry({ indexStore, entryStore, indexEntry: indexEntry(1, 30), entry: readableEntry(1, 30) });
    appendReadableRuntimeEntry({ indexStore, entryStore, indexEntry: indexEntry(2, 31), entry: readableEntry(2, 31) });

    expect(formatAllReadableRuntimeEntriesCopy({ indexStore, entryStore })).toContain('detail 30');
    expect(formatAllReadableRuntimeEntriesCopy({ indexStore, entryStore })).toContain('detail 31');
  });

  it('clears readable index and retained detail stores together', () => {
    const indexStore: RuntimeLogIndexEntry[] = [];
    const entryStore = new Map<string, ReadableRuntimeEntry>();

    appendReadableRuntimeEntry({ indexStore, entryStore, indexEntry: indexEntry(1, 40), entry: readableEntry(1, 40) });
    const visible = clearReadableRuntimeLogStores({ indexStore, entryStore });

    expect(visible).toEqual([]);
    expect(indexStore).toEqual([]);
    expect(entryStore.size).toBe(0);
  });
});
