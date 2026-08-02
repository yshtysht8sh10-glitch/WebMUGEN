import { describe, expect, it } from 'vitest';
import {
  calculateTestTimeoutMs,
  MINIMUM_TEST_TIMEOUT_MS,
  TIMEOUT_STEP_MS,
} from './TestTimeoutBudget';

describe('dynamic test timeout budget', () => {
  it('starts at twice the former five-second timeout', () => {
    expect(calculateTestTimeoutMs({ dataCount: 0, testCount: 0 })).toBe(MINIMUM_TEST_TIMEOUT_MS);
    expect(MINIMUM_TEST_TIMEOUT_MS).toBe(10_000);
  });

  it('adds capacity as target data and test counts cross their step boundaries', () => {
    expect(calculateTestTimeoutMs({ dataCount: 1, testCount: 1 })).toBe(
      MINIMUM_TEST_TIMEOUT_MS + TIMEOUT_STEP_MS * 2,
    );
    expect(calculateTestTimeoutMs({ dataCount: 501, testCount: 251 })).toBe(
      MINIMUM_TEST_TIMEOUT_MS + TIMEOUT_STEP_MS * 4,
    );
  });

  it('rejects invalid counts instead of hiding configuration errors', () => {
    expect(() => calculateTestTimeoutMs({ dataCount: -1, testCount: 1 })).toThrow(/dataCount/);
    expect(() => calculateTestTimeoutMs({ dataCount: 1, testCount: Number.NaN })).toThrow(/testCount/);
  });
});
