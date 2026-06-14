import type { CnsRuntimeTrace } from '../core/cns/CnsStateRuntime';

export function formatCnsRuntimeDebugOverlay(traces: readonly CnsRuntimeTrace[]): string[] {
  if (traces.length === 0) {
    return ['cns=-'];
  }

  return traces.map((trace) => {
    const controllers =
      trace.executedControllers.length > 0 ? trace.executedControllers.join(',') : '-';

    return `cns p${trace.playerId} state=${trace.stateNo}->${trace.afterStateNo} anim=${
      trace.animNo
    }->${trace.afterAnimNo} time=${trace.stateTime}->${trace.afterStateTime} animtime=${
      trace.mugenAnimTime
    } found=${trace.stateFound ? 1 : 0} exec=${controllers}`;
  });
}
