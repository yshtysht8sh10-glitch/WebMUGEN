import type { CnsRuntimeTrace } from '../core/cns/CnsStateRuntime';

export function formatCnsRuntimeDebugOverlay(traces: CnsRuntimeTrace[]): string[] {
  return traces.map((trace) => {
    const controllers =
      trace.executedControllers.length > 0
        ? trace.executedControllers.join(',')
        : '-';

    return `cns p${trace.playerId} state=${trace.stateNo} found=${trace.stateFound ? 1 : 0} exec=${controllers}`;
  });
}
