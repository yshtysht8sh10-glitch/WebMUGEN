import { describe, expect, it } from 'vitest';
import { formatCnsCommandDebugOverlay } from './CnsCommandDebugOverlay';

describe('CnsCommandDebugOverlay', () => {
  it('formats command sets', () => {
    const lines = formatCnsCommandDebugOverlay(new Set(['x', 'qcf_x']), new Set());

    expect(lines[0]).toBe('cmd p1=qcf_x,x');
    expect(lines[1]).toBe('cmd p2=-');
  });
});
