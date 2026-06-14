import { describe, expect, it } from 'vitest';
import { formatInputDebugOverlay } from './InputDebugOverlay';
import { createInputDebugSnapshot } from '../input/InputDebugInfo';

describe('InputDebugOverlay', () => {
  it('formats input debug lines', () => {
    const lines = formatInputDebugOverlay(createInputDebugSnapshot(new Set(['ArrowRight', 'KeyA'])));

    expect(lines[0]).toContain('ArrowRight');
    expect(lines[1]).toContain('R=0');
    expect(lines[2]).toContain('R=1');
    expect(lines[2]).toContain('A=1');
  });

  it('formats restart key', () => {
    const lines = formatInputDebugOverlay(createInputDebugSnapshot(new Set(['KeyR'])));

    expect(lines[1]).toContain('R=1');
  });
});
