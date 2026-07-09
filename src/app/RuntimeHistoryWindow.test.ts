import { describe, expect, it } from 'vitest';
import {
  limitRuntimeHistoryEntries,
  selectVisibleRuntimeHistory,
} from './RuntimeHistoryWindow';

function humanEntry(frame: number): string[] {
  return [
    `---- 12:00:00 frame=${frame} ----`,
    `P1 StateNo=${frame} Time=0 AnimNo=0`,
  ];
}

function aiEntry(frame: number): string[] {
  return [
    `===== AI_RUNTIME frame=${frame} timestamp=12:00:00 =====`,
    'SECTION input',
    'END AI_RUNTIME',
  ];
}

describe('RuntimeHistoryWindow', () => {
  it('renders only the latest 200 human entries by default', () => {
    const lines = Array.from({ length: 240 }, (_, index) => humanEntry(240 - index)).flat();
    const visible = selectVisibleRuntimeHistory(lines, 'human', { mode: 'latest' });

    expect(visible.visibleEntries).toBe(200);
    expect(visible.lines[0]).toContain('frame=240');
    expect(visible.lines.at(-2)).toContain('frame=41');
    expect(visible.totalEntries).toBe(240);
  });

  it('renders a window around the target frame when jumping', () => {
    const lines = Array.from({ length: 300 }, (_, index) => humanEntry(300 - index)).flat();
    const visible = selectVisibleRuntimeHistory(lines, 'human', { mode: 'aroundFrame', targetFrame: 150 });

    expect(visible.targetFound).toBe(true);
    expect(visible.visibleEntries).toBe(201);
    expect(visible.lines.join('\n')).toContain('frame=150');
    expect(visible.lines[0]).toContain('frame=250');
    expect(visible.lines.at(-2)).toContain('frame=50');
  });

  it('falls back to latest when the target frame is not retained', () => {
    const lines = Array.from({ length: 20 }, (_, index) => humanEntry(20 - index)).flat();
    const visible = selectVisibleRuntimeHistory(lines, 'human', { mode: 'aroundFrame', targetFrame: 999 });

    expect(visible.targetFound).toBe(false);
    expect(visible.visibleEntries).toBe(20);
    expect(visible.lines[0]).toContain('frame=20');
  });

  it('uses AI runtime entries independently from line count', () => {
    const lines = Array.from({ length: 220 }, (_, index) => aiEntry(220 - index)).flat();
    const visible = selectVisibleRuntimeHistory(lines, 'ai', { mode: 'latest' });

    expect(visible.visibleEntries).toBe(200);
    expect(visible.lines[0]).toContain('frame=220');
    expect(visible.lines.at(-3)).toContain('frame=21');
  });

  it('limits internal history by entries rather than raw lines', () => {
    const lines = Array.from({ length: 12 }, (_, index) => aiEntry(12 - index)).flat();
    const limited = limitRuntimeHistoryEntries(lines, 'ai', 5);

    expect(limited.filter((line) => line.startsWith('===== AI_RUNTIME '))).toHaveLength(5);
    expect(limited[0]).toContain('frame=12');
    expect(limited.at(-3)).toContain('frame=8');
  });
});
