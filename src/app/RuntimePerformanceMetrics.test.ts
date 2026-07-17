import { describe, expect, it } from 'vitest';
import { DEFAULT_RUNTIME_SETTINGS } from './RuntimeSettings';
import { RUNTIME_PERFORMANCE_SAMPLE_LIMIT, RuntimePerformanceMetrics, type RuntimePerformanceSample } from './RuntimePerformanceMetrics';

describe('Issue #75 RuntimePerformanceMetrics', () => {
  it('reports FPS, p50/p95, diagnostic costs, and buffer sizes from a fixed sample window', () => {
    const metrics = new RuntimePerformanceMetrics();
    for (let index = 1; index <= RUNTIME_PERFORMANCE_SAMPLE_LIMIT + 10; index += 1) {
      metrics.record(sample(index));
    }

    const snapshot = metrics.snapshot(DEFAULT_RUNTIME_SETTINGS);
    expect(snapshot.sampleCount).toBe(RUNTIME_PERFORMANCE_SAMPLE_LIMIT);
    expect(snapshot.frameTimeP50Ms).toBeGreaterThan(300);
    expect(snapshot.frameTimeP95Ms).toBeGreaterThan(snapshot.frameTimeP50Ms);
    expect(snapshot.averages.diagnosticMs).toBe(2);
    expect(snapshot.averages.aiBufferLines).toBe(20);
  });
});

function sample(frameTimeMs: number): RuntimePerformanceSample {
  return {
    frameTimeMs,
    simulationMs: 4,
    cnsMs: 3,
    diagnosticMs: 2,
    logSerializationMs: 1,
    debugUiUpdateMs: 0.5,
    canvasNormalMs: 5,
    canvasDebugMs: 1,
    generatedLogEntries: 2,
    generatedLogCharacters: 100,
    aiBufferLines: 20,
    humanBufferEntries: 10,
    stateHistoryLines: 5,
  };
}
