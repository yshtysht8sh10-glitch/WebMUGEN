export type DefPaletteEntry = {
  slot: number;
  file: string;
};

export function parseDefPaletteEntries(defText: string): DefPaletteEntry[] {
  const lines = defText.split(/\r?\n/);
  const entries: DefPaletteEntry[] = [];

  for (const rawLine of lines) {
    const line = stripComment(rawLine).trim();
    const match = /^pal(\d+)\s*=\s*(.+)$/i.exec(line);

    if (!match) {
      continue;
    }

    entries.push({
      slot: Number(match[1]),
      file: normalizePath(match[2]),
    });
  }

  return entries.sort((a, b) => a.slot - b.slot);
}

export function resolvePaletteFile(entries: readonly DefPaletteEntry[], requestedSlot: number): string | null {
  return entries.find((entry) => entry.slot === requestedSlot)?.file ?? entries[0]?.file ?? null;
}

function stripComment(line: string): string {
  const index = line.indexOf(';');
  return index >= 0 ? line.slice(0, index) : line;
}

function normalizePath(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
}
