import type { RuntimeSettings } from './RuntimeSettings';

export const RUNTIME_PERFORMANCE_SAMPLE_LIMIT = 600;

export type RuntimePerformanceSample = {
  frameTimeMs: number;
  simulationMs: number;
  cnsMs: number;
  diagnosticMs: number;
  logSerializationMs: number;
  debugUiUpdateMs: number;
  canvasNormalMs: number;
  canvasDebugMs: number;
  generatedLogEntries: number;
  generatedLogCharacters: number;
  aiBufferLines: number;
  humanBufferEntries: number;
  stateHistoryLines: number;
};

export type RuntimePerformanceSnapshot = {
  settings: Pick<RuntimeSettings, 'humanLogEnabled' | 'aiLogEnabled' | 'collisionBoxesVisible' | 'stateHistoryVisible'>;
  sampleCount: number;
  averageFps: number;
  frameTimeP50Ms: number;
  frameTimeP95Ms: number;
  averages: Omit<RuntimePerformanceSample, 'frameTimeMs'> & { frameTimeMs: number };
};

export class RuntimePerformanceMetrics {
  private samples: RuntimePerformanceSample[] = [];

  record(sample: RuntimePerformanceSample): void {
    this.samples.push(sample);
    if (this.samples.length > RUNTIME_PERFORMANCE_SAMPLE_LIMIT) {
      this.samples.splice(0, this.samples.length - RUNTIME_PERFORMANCE_SAMPLE_LIMIT);
    }
  }

  clear(): void {
    this.samples = [];
  }

  snapshot(settings: RuntimeSettings): RuntimePerformanceSnapshot {
    const frameTimes = this.samples.map((sample) => sample.frameTimeMs).sort((left, right) => left - right);
    const averages = averageSamples(this.samples);
    return {
      settings: {
        humanLogEnabled: settings.humanLogEnabled,
        aiLogEnabled: settings.aiLogEnabled,
        collisionBoxesVisible: settings.collisionBoxesVisible,
        stateHistoryVisible: settings.stateHistoryVisible,
      },
      sampleCount: this.samples.length,
      averageFps: averages.frameTimeMs > 0 ? 1000 / averages.frameTimeMs : 0,
      frameTimeP50Ms: percentile(frameTimes, 0.5),
      frameTimeP95Ms: percentile(frameTimes, 0.95),
      averages,
    };
  }
}

function averageSamples(samples: readonly RuntimePerformanceSample[]): RuntimePerformanceSample {
  const empty: RuntimePerformanceSample = {
    frameTimeMs: 0,
    simulationMs: 0,
    cnsMs: 0,
    diagnosticMs: 0,
    logSerializationMs: 0,
    debugUiUpdateMs: 0,
    canvasNormalMs: 0,
    canvasDebugMs: 0,
    generatedLogEntries: 0,
    generatedLogCharacters: 0,
    aiBufferLines: 0,
    humanBufferEntries: 0,
    stateHistoryLines: 0,
  };
  if (samples.length === 0) return empty;
  for (const sample of samples) {
    for (const key of Object.keys(empty) as Array<keyof RuntimePerformanceSample>) empty[key] += sample[key];
  }
  for (const key of Object.keys(empty) as Array<keyof RuntimePerformanceSample>) empty[key] /= samples.length;
  return empty;
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

declare global {
  interface Window {
    __WEBMUGEN_PERFORMANCE__?: RuntimePerformanceSnapshot;
  }
}
