import { describe, expect, it } from 'vitest';
import { InputBuffer } from './InputBuffer';

describe('InputBuffer clone', () => {
  it('clones frames without mutating the original buffer', () => {
    const original = new InputBuffer(10);
    original.push({ left: false, right: false, down: true, up: false, attack: false });

    const cloned = original.clone();
    cloned.push({ left: false, right: true, down: true, up: false, attack: false });

    expect(original.getFrames().map((frame) => frame.direction)).toEqual(['D']);
    expect(cloned.getFrames().map((frame) => frame.direction)).toEqual(['DF', 'D']);
  });
});
