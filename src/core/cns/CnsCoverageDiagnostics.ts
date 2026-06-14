import type {
  CnsDocument,
  CnsStateController,
  CnsTrigger,
} from '../../mugen/common/cnsTypes';

export type CnsCoverageStatus = 'supported' | 'partial' | 'unsupported';

export type CnsControllerCoverage = {
  name: string;
  count: number;
  status: CnsCoverageStatus;
};

export type CnsTriggerCoverage = {
  name: string;
  count: number;
  status: CnsCoverageStatus;
  examples: string[];
};

export type CnsCoverageDiagnostics = {
  stateCount: number;
  controllerCount: number;
  triggerCount: number;
  controllers: CnsControllerCoverage[];
  triggers: CnsTriggerCoverage[];
  unsupportedControllers: CnsControllerCoverage[];
  unsupportedTriggers: CnsTriggerCoverage[];
};

const SUPPORTED_CONTROLLERS = new Set([
  'changeanim',
  'changestate',
  'ctrlset',
  'posadd',
  'posset',
  'veladd',
  'velset',
]);

const PARTIAL_CONTROLLERS = new Set([
  'hitdef',
  'projectile',
]);

const SUPPORTED_TRIGGER_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'constant', pattern: /^(?:0|1)$/i },
  { name: 'time', pattern: /^time\s*(?:=|!=|>=|<=|>|<)\s*-?\d+$/i },
  { name: 'animtime', pattern: /^animtime\s*(?:=|!=|>=|<=|>|<)\s*-?\d+$/i },
  { name: 'ctrl', pattern: /^ctrl$/i },
  { name: 'command', pattern: /^command\s*=\s*"[^"]+"$/i },
  { name: 'statetype', pattern: /^statetype\s*(?:=|!=)\s*[sca]$/i },
  { name: 'movetype', pattern: /^movetype\s*(?:=|!=)\s*[aih]$/i },
];

const PARTIAL_TRIGGER_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'animelem', pattern: /^animelem(?:time)?\b/i },
  { name: 'var', pattern: /^(?:var|fvar|sysvar|sysfvar)\s*\(/i },
  { name: 'pos', pattern: /^pos\s+(?:x|y)\s*(?:=|!=|>=|<=|>|<)/i },
  { name: 'vel', pattern: /^vel\s+(?:x|y)\s*(?:=|!=|>=|<=|>|<)/i },
  { name: 'anim', pattern: /^anim\s*(?:=|!=|>=|<=|>|<)/i },
  { name: 'stateno', pattern: /^stateno\s*(?:=|!=|>=|<=|>|<)/i },
  { name: 'numhelper', pattern: /^numhelper\b/i },
  { name: 'numproj', pattern: /^numproj\b/i },
];

export function analyzeCnsCoverage(cnsDocument: CnsDocument): CnsCoverageDiagnostics {
  const controllerCounts = new Map<string, number>();
  const triggerRecords = new Map<string, { count: number; examples: Set<string>; status: CnsCoverageStatus }>();

  for (const state of cnsDocument.states) {
    for (const controller of state.controllers) {
      const controllerName = normalizeControllerName(controller);
      controllerCounts.set(controllerName, (controllerCounts.get(controllerName) ?? 0) + 1);

      for (const trigger of controller.triggers) {
        const triggerName = classifyTrigger(trigger.expression);
        const status = classifyTriggerStatus(trigger.expression);
        const existing = triggerRecords.get(triggerName) ?? {
          count: 0,
          examples: new Set<string>(),
          status,
        };

        existing.count += 1;
        existing.status = mergeCoverageStatus(existing.status, status);
        if (existing.examples.size < 3) {
          existing.examples.add(trigger.expression);
        }

        triggerRecords.set(triggerName, existing);
      }
    }
  }

  const controllers = Array.from(controllerCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      status: classifyControllerStatus(name),
    }))
    .sort(sortCoverageByStatusThenName);

  const triggers = Array.from(triggerRecords.entries())
    .map(([name, value]) => ({
      name,
      count: value.count,
      status: value.status,
      examples: Array.from(value.examples),
    }))
    .sort(sortCoverageByStatusThenName);

  const controllerCount = cnsDocument.states.reduce(
    (total, state) => total + state.controllers.length,
    0,
  );
  const triggerCount = cnsDocument.states.reduce(
    (total, state) =>
      total + state.controllers.reduce((sum, controller) => sum + controller.triggers.length, 0),
    0,
  );

  return {
    stateCount: cnsDocument.states.length,
    controllerCount,
    triggerCount,
    controllers,
    triggers,
    unsupportedControllers: controllers.filter((item) => item.status === 'unsupported'),
    unsupportedTriggers: triggers.filter((item) => item.status === 'unsupported'),
  };
}

export function formatCnsCoverageDiagnostics(diagnostics: CnsCoverageDiagnostics): string[] {
  const unsupportedControllerSummary = diagnostics.unsupportedControllers
    .slice(0, 6)
    .map((item) => `${item.name}(${item.count})`)
    .join(',');

  const unsupportedTriggerSummary = diagnostics.unsupportedTriggers
    .slice(0, 6)
    .map((item) => `${item.name}(${item.count})`)
    .join(',');

  return [
    `coverage states=${diagnostics.stateCount} controllers=${diagnostics.controllerCount} triggers=${diagnostics.triggerCount}`,
    `coverage unsupported controllers=${unsupportedControllerSummary || '-'}`,
    `coverage unsupported triggers=${unsupportedTriggerSummary || '-'}`,
  ];
}

function normalizeControllerName(controller: CnsStateController): string {
  return controller.type.trim().toLowerCase() || '(missing-type)';
}

function classifyControllerStatus(name: string): CnsCoverageStatus {
  if (SUPPORTED_CONTROLLERS.has(name)) {
    return 'supported';
  }

  if (PARTIAL_CONTROLLERS.has(name)) {
    return 'partial';
  }

  return 'unsupported';
}

function classifyTrigger(expression: string): string {
  const trimmed = expression.trim().toLowerCase();

  for (const entry of SUPPORTED_TRIGGER_PATTERNS) {
    if (entry.pattern.test(trimmed)) {
      return entry.name;
    }
  }

  for (const entry of PARTIAL_TRIGGER_PATTERNS) {
    if (entry.pattern.test(trimmed)) {
      return entry.name;
    }
  }

  const leadingIdentifier = trimmed.match(/^([a-z_][a-z0-9_]*)/i);
  return leadingIdentifier?.[1] ?? '(unknown)';
}

function classifyTriggerStatus(expression: string): CnsCoverageStatus {
  const trimmed = expression.trim().toLowerCase();

  if (SUPPORTED_TRIGGER_PATTERNS.some((entry) => entry.pattern.test(trimmed))) {
    return 'supported';
  }

  if (PARTIAL_TRIGGER_PATTERNS.some((entry) => entry.pattern.test(trimmed))) {
    return 'partial';
  }

  return 'unsupported';
}

function mergeCoverageStatus(a: CnsCoverageStatus, b: CnsCoverageStatus): CnsCoverageStatus {
  if (a === 'unsupported' || b === 'unsupported') {
    return 'unsupported';
  }

  if (a === 'partial' || b === 'partial') {
    return 'partial';
  }

  return 'supported';
}

function sortCoverageByStatusThenName<T extends { status: CnsCoverageStatus; name: string }>(
  a: T,
  b: T,
): number {
  const statusOrder: Record<CnsCoverageStatus, number> = {
    unsupported: 0,
    partial: 1,
    supported: 2,
  };

  return statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name);
}
