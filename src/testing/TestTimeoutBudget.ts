export const ORIGINAL_TEST_TIMEOUT_MS = 5_000;
export const MINIMUM_TEST_TIMEOUT_MS = ORIGINAL_TEST_TIMEOUT_MS * 2;
export const DATA_ITEMS_PER_TIMEOUT_STEP = 500;
export const TESTS_PER_TIMEOUT_STEP = 250;
export const TIMEOUT_STEP_MS = 500;

export function calculateTestTimeoutMs({
  dataCount,
  testCount,
}: {
  dataCount: number;
  testCount: number;
}): number {
  const normalizedDataCount = normalizeCount(dataCount, 'dataCount');
  const normalizedTestCount = normalizeCount(testCount, 'testCount');
  const dataSteps = Math.ceil(normalizedDataCount / DATA_ITEMS_PER_TIMEOUT_STEP);
  const testSteps = Math.ceil(normalizedTestCount / TESTS_PER_TIMEOUT_STEP);
  return MINIMUM_TEST_TIMEOUT_MS + (dataSteps + testSteps) * TIMEOUT_STEP_MS;
}

function normalizeCount(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative number.`);
  }
  return Math.ceil(value);
}
