import { describe, expect, it } from 'vitest';
import {
  createCnsCommandSet,
  createCnsCommandSetFromMatches,
  createFallbackCnsCommandSet,
  hasCommandDefinition,
} from './CnsCommandInput';

describe('CnsCommandInput', () => {
  it('creates normalized CNS command set from resolved commands', () => {
    const commands = createCnsCommandSet([
      { name: 'X' },
      { name: 'QCF_X' },
    ]);

    expect(commands.has('x')).toBe(true);
    expect(commands.has('qcf_x')).toBe(true);
  });

  it('creates normalized CNS command set from runtime matches', () => {
    const commands = createCnsCommandSetFromMatches([
      { matched: true, commandName: 'QCF_X', matchedFrames: [1, 2, 3, 4] },
      { matched: true, commandName: 'Y', matchedFrames: [5] },
    ]);

    expect(commands.has('qcf_x')).toBe(true);
    expect(commands.has('y')).toBe(true);
  });

  it('creates fallback command set from fallback input', () => {
    const commands = createFallbackCnsCommandSet({
      attack: true,
      projectile: true,
    });

    expect(commands.has('x')).toBe(true);
    expect(commands.has('qcf_x')).toBe(true);
  });

  it('detects command definition by name', () => {
    expect(
      hasCommandDefinition(
        [
          { name: 'x', command: 'x', time: 1 },
          { name: 'qcf_x', command: 'D, DF, F, x', time: 15 },
        ],
        'QCF_X',
      ),
    ).toBe(true);
  });
});
