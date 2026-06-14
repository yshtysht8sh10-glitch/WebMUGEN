export function formatCnsCommandDebugOverlay(
  p1Commands: ReadonlySet<string>,
  p2Commands: ReadonlySet<string>,
): string[] {
  return [
    `cmd p1=${formatCommandSet(p1Commands)}`,
    `cmd p2=${formatCommandSet(p2Commands)}`,
  ];
}

function formatCommandSet(commands: ReadonlySet<string>): string {
  return commands.size > 0 ? Array.from(commands).sort().join(',') : '-';
}
