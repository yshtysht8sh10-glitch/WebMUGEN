export const RUNTIME_HISTORY_STORE_LIMIT = 5000;
export const RUNTIME_HISTORY_VISIBLE_LIMIT = 50;
export const RUNTIME_HISTORY_VISIBLE_LINE_LIMIT = 1200;
export const RUNTIME_HISTORY_CONTEXT_BEFORE = 100;
export const RUNTIME_HISTORY_CONTEXT_AFTER = 100;
const RUNTIME_HISTORY_FULL_COUNT_LINE_SCAN_LIMIT = 20000;

export type RuntimeHistoryKind = 'human' | 'ai';

export type RuntimeHistoryWindow =
  | { mode: 'latest' }
  | { mode: 'aroundFrame'; targetFrame: number };

export type RuntimeHistoryEntry = {
  start: number;
  end: number;
  frameNo: number | null;
};

export type VisibleRuntimeHistory = {
  lines: string[];
  mode: RuntimeHistoryWindow['mode'];
  targetFrame: number | null;
  targetFound: boolean;
  totalEntries: number;
  visibleEntries: number;
  rangeLabel: string;
};

export function limitRuntimeHistoryEntries(
  lines: readonly string[],
  kind: RuntimeHistoryKind,
  limit = RUNTIME_HISTORY_STORE_LIMIT,
): string[] {
  const entries = collectRuntimeHistoryEntries(lines, kind, limit + 1);
  if (entries.length <= limit) return [...lines];
  const lastEntry = entries[limit - 1];
  return lines.slice(0, lastEntry.end);
}

export function selectVisibleRuntimeHistory(
  lines: readonly string[],
  kind: RuntimeHistoryKind,
  window: RuntimeHistoryWindow,
): VisibleRuntimeHistory {
  const entries = collectRuntimeHistoryEntries(
    lines,
    kind,
    window.mode === 'latest' && lines.length > RUNTIME_HISTORY_FULL_COUNT_LINE_SCAN_LIMIT
      ? RUNTIME_HISTORY_VISIBLE_LIMIT + 1
      : undefined,
  );
  if (entries.length === 0) {
    return {
      lines: [...lines],
      mode: window.mode,
      targetFrame: window.mode === 'aroundFrame' ? window.targetFrame : null,
      targetFound: window.mode !== 'aroundFrame',
      totalEntries: 0,
      visibleEntries: 0,
      rangeLabel: '0/0',
    };
  }

  const targetIndex = window.mode === 'aroundFrame'
    ? entries.findIndex((entry) => entry.frameNo === window.targetFrame)
    : -1;
  const targetFound = window.mode !== 'aroundFrame' || targetIndex >= 0;
  const centerIndex = targetIndex >= 0 ? targetIndex : 0;
  const startEntryIndex = window.mode === 'aroundFrame' && targetIndex >= 0
    ? Math.max(0, centerIndex - RUNTIME_HISTORY_CONTEXT_AFTER)
    : 0;
  const endEntryIndex = window.mode === 'aroundFrame' && targetIndex >= 0
    ? Math.min(entries.length - 1, centerIndex + RUNTIME_HISTORY_CONTEXT_BEFORE)
    : Math.min(entries.length - 1, RUNTIME_HISTORY_VISIBLE_LIMIT - 1);
  const startLine = entries[startEntryIndex].start;
  const endLine = entries[endEntryIndex].end;
  const visibleEntries = endEntryIndex - startEntryIndex + 1;
  const visibleLines = capVisibleRuntimeHistoryLines(lines.slice(startLine, endLine), window.mode);
  const totalLabel = window.mode === 'latest'
    && lines.length > RUNTIME_HISTORY_FULL_COUNT_LINE_SCAN_LIMIT
    && entries.length > RUNTIME_HISTORY_VISIBLE_LIMIT
    ? `${RUNTIME_HISTORY_VISIBLE_LIMIT}+`
    : `${entries.length}`;

  return {
    lines: visibleLines,
    mode: window.mode,
    targetFrame: window.mode === 'aroundFrame' ? window.targetFrame : null,
    targetFound,
    totalEntries: entries.length,
    visibleEntries,
    rangeLabel: `${startEntryIndex + 1}-${endEntryIndex + 1}/${totalLabel}`,
  };
}

export function collectRuntimeHistoryEntries(
  lines: readonly string[],
  kind: RuntimeHistoryKind,
  maxEntries?: number,
): RuntimeHistoryEntry[] {
  const entries: RuntimeHistoryEntry[] = [];
  let currentStart = -1;
  let currentFrame: number | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!isRuntimeHistoryEntryStart(line, kind)) continue;
    if (currentStart >= 0) entries.push({ start: currentStart, end: index, frameNo: currentFrame });
    if (maxEntries !== undefined && entries.length >= maxEntries) return entries;
    currentStart = index;
    currentFrame = extractRuntimeHistoryFrameNo(line, kind);
  }

  if (currentStart >= 0) entries.push({ start: currentStart, end: lines.length, frameNo: currentFrame });
  return entries;
}

export function extractRuntimeHistoryFrameNo(line: string, kind: RuntimeHistoryKind): number | null {
  const match = kind === 'ai'
    ? line.match(/\bframe=(\d+)\b/)
    : line.match(/\bframe=(\d+)\b/);
  return match ? Number(match[1]) : null;
}

function isRuntimeHistoryEntryStart(line: string, kind: RuntimeHistoryKind): boolean {
  return kind === 'ai'
    ? line.startsWith('===== AI_RUNTIME ')
    : line.startsWith('---- ');
}

function capVisibleRuntimeHistoryLines(lines: string[], mode: RuntimeHistoryWindow['mode']): string[] {
  if (mode !== 'latest' || lines.length <= RUNTIME_HISTORY_VISIBLE_LINE_LIMIT) return lines;
  const omitted = lines.length - RUNTIME_HISTORY_VISIBLE_LINE_LIMIT;
  return [
    ...lines.slice(0, RUNTIME_HISTORY_VISIBLE_LINE_LIMIT),
    `... ${omitted} rendered lines hidden; use full log copy or a frame jump for more context ...`,
  ];
}
