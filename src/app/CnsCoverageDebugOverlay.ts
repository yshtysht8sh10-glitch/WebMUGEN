import type { CnsCoverageDiagnostics } from '../core/cns/CnsCoverageDiagnostics';
import { formatCnsCoverageDiagnostics } from '../core/cns/CnsCoverageDiagnostics';

export function formatCnsCoverageDebugOverlay(
  diagnostics: CnsCoverageDiagnostics | null,
): string[] {
  if (!diagnostics) {
    return ['coverage=-'];
  }

  return formatCnsCoverageDiagnostics(diagnostics);
}
