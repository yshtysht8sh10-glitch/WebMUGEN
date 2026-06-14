import { describe, expect, it } from 'vitest';
import { createInputDebugSnapshot } from './InputDebugInfo';

describe('InputDebugInfo', () => {
  it('creates P1/P2 input debug snapshot', () => {
    const snapshot = createInputDebugSnapshot(new Set(['ArrowLeft', 'ArrowDown', 'KeyA', 'KeyF']));

    expect(snapshot.p1.left).toBe(true);
    expect(snapshot.p1.projectile).toBe(true);
    expect(snapshot.p2.attack).toBe(true);
    expect(snapshot.p2.left).toBe(false);
    expect(snapshot.pressedKeys).toEqual(['ArrowDown', 'ArrowLeft', 'KeyA', 'KeyF']);
  });

  it('detects round restart input', () => {
    const snapshot = createInputDebugSnapshot(new Set(['KeyR']));

    expect(snapshot.system.restartRound).toBe(true);
  });
});
