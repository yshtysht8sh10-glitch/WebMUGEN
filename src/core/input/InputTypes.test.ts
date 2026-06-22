import { describe, expect, it } from 'vitest';
import { normalizeInputTokens, snapshotToTokens } from './InputTypes';

describe('Phase87 InputTypes', () => {
  it('normalizes direction and button tokens', () => {
    expect(normalizeInputTokens([' d ', 'DF', 'X', 'bad', 'a'])).toEqual(['D', 'DF', 'x', 'a']);
  });

  it('converts snapshots to tokens', () => {
    expect(snapshotToTokens({ direction: 'F', buttons: ['x', 'y'] })).toEqual(['F', 'x', 'y']);
  });
});
