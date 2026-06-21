import { describe, expect, it } from 'vitest';
import { addPower, clampPower, hasPower, powerLevel, spendPower } from './PowerGauge';

describe('Phase58 PowerGauge', () => {
  it('clamps and adds power', () => {
    expect(clampPower(-10)).toBe(0);
    expect(clampPower(9999)).toBe(3000);
    expect(addPower(2500, 800)).toBe(3000);
  });

  it('spends power safely', () => {
    expect(spendPower(1000, 500)).toEqual({ power: 500, spent: true });
    expect(spendPower(100, 500)).toEqual({ power: 100, spent: false });
  });

  it('checks levels', () => {
    expect(hasPower(1000, 1000)).toBe(true);
    expect(powerLevel(2999)).toBe(2);
    expect(powerLevel(3000)).toBe(3);
  });
});
