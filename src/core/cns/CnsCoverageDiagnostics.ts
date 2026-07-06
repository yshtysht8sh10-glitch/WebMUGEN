import type { CnsDocument, CnsStateController } from '../../mugen/common/cnsTypes';

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
  'angleadd',
  'attackmulset',
  'changeanim',
  'changestate',
  'ctrlset',
  'defencemulset',
  'hitadd',
  'hitby',
  'hitfalldamage',
  'hitfallvel',
  'hitvelset',
  'lifeadd',
  'lifeset',
  'movetypeset',
  'nothitby',
  'null',
  'offset',
  'pause',
  'playerpush',
  'posadd',
  'posset',
  'poweradd',
  'powerset',
  'selfstate',
  'sprpriority',
  'statetypeset',
  'superpause',
  'trans',
  'turn',
  'varadd',
  'varrandom',
  'varrangeset',
  'varset',
  'veladd',
  'velmul',
  'velset',
  'width',
]);

const PARTIAL_CONTROLLERS = new Set([
  'afterimage',
  'allpalfx',
  'angledraw',
  'appendtoclipboard',
  'assertspecial',
  'attackdist',
  'bgpalfx',
  'bindtoparent',
  'bindtoroot',
  'bindtotarget',
  'changeanim2',
  'clearclipboard',
  'destroyself',
  'displaytoclipboard',
  'envcolor',
  'envshake',
  'explod',
  'explodbindtime',
  'fallenvshake',
  'forcefeedback',
  'gamemakeanim',
  'gravity',
  'helper',
  'hitdef',
  'hitfallset',
  'hitoverride',
  'makedust',
  'modifyexplod',
  'movehitreset',
  'palfx',
  'parentvaradd',
  'parentvarset',
  'playsnd',
  'posfreeze',
  'projectile',
  'removeexplod',
  'reversaldef',
  'screenbound',
  'sndpan',
  'stopsnd',
  'targetbind',
  'targetdrop',
  'targetfacing',
  'targetlifeadd',
  'targetpoweradd',
  'targetstate',
  'targetveladd',
  'targetvelset',
  'zoom',
]);

const SUPPORTED_TRIGGER_NAMES = new Set([
  'abs',
  'alive',
  'anim',
  'animelem',
  'animelemno',
  'animelemtime',
  'animexist',
  'animtime',
  'ceil',
  'command',
  'constant',
  'const',
  'ctrl',
  'facing',
  'floor',
  'gametime',
  'gethitvar',
  'hitfall',
  'ifelse',
  'life',
  'movetype',
  'p2bodydist',
  'p2dist',
  'p2life',
  'p2movetype',
  'p2stateno',
  'p2statetype',
  'pos',
  'power',
  'prevstateno',
  'random',
  'roundno',
  'roundsexisted',
  'selfanimexist',
  'stateno',
  'statetype',
  'teamside',
  'time',
  'vel',
]);

const PARTIAL_TRIGGER_NAMES = new Set([
  'backedgebodydist',
  'canrecover',
  'enemy',
  'enemynear',
  'frontedgebodydist',
  'fvar',
  'helper',
  'hitcount',
  'hitover',
  'hitshakeover',
  'inguarddist',
  'matchover',
  'movecontact',
  'moveguarded',
  'movehit',
  'numexplod',
  'numhelper',
  'numproj',
  'palno',
  'parent',
  'projhit',
  'projhittime',
  'root',
  'target',
  'teammode',
  'timemod',
  'sysfvar',
  'sysvar',
  'var',
  'win',
  'winko',
]);

const SUPPORTED_TRIGGER_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'constant', pattern: /^(?:0|1)$/i },
  { name: 'time', pattern: /^time\s*(?:=|!=|>=|<=|>|<)\s*-?\d+(?:\.\d+)?$/i },
  { name: 'animtime', pattern: /^animtime\s*(?:=|!=|>=|<=|>|<)\s*-?\d+(?:\.\d+)?$/i },
  { name: 'ctrl', pattern: /^ctrl$/i },
  { name: 'command', pattern: /^command\s*=\s*"[^"]+"$/i },
  { name: 'statetype', pattern: /^statetype\s*(?:=|!=)\s*[sca]$/i },
  { name: 'movetype', pattern: /^movetype\s*(?:=|!=)\s*[aih]$/i },
  { name: 'anim', pattern: /^anim\s*(?:=|!=|>=|<=|>|<)\s*-?\d+$/i },
  { name: 'stateno', pattern: /^stateno\s*(?:=|!=|>=|<=|>|<)\s*-?\d+$/i },
  { name: 'pos', pattern: /^pos\s+(?:x|y)\s*(?:=|!=|>=|<=|>|<)\s*-?\d+(?:\.\d+)?$/i },
  { name: 'vel', pattern: /^vel\s+(?:x|y)\s*(?:=|!=|>=|<=|>|<)\s*-?\d+(?:\.\d+)?$/i },
  { name: 'facing', pattern: /^facing\s*(?:=|!=|>=|<=|>|<)\s*-?1$/i },
];

const PARTIAL_TRIGGER_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'animelem', pattern: /^animelem(?:time)?\b/i },
  { name: 'var', pattern: /^(?:var|fvar|sysvar|sysfvar)\s*\(/i },
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
        const existing = triggerRecords.get(triggerName) ?? { count: 0, examples: new Set<string>(), status };
        existing.count += 1;
        existing.status = mergeCoverageStatus(existing.status, status);
        if (existing.examples.size < 3) existing.examples.add(trigger.expression);
        triggerRecords.set(triggerName, existing);
      }
    }
  }

  const controllers = Array.from(controllerCounts.entries())
    .map(([name, count]) => ({ name, count, status: classifyControllerStatus(name) }))
    .sort(sortCoverageByStatusThenName);

  const triggers = Array.from(triggerRecords.entries())
    .map(([name, value]) => ({ name, count: value.count, status: value.status, examples: Array.from(value.examples) }))
    .sort(sortCoverageByStatusThenName);

  const controllerCount = cnsDocument.states.reduce((total, state) => total + state.controllers.length, 0);
  const triggerCount = cnsDocument.states.reduce((total, state) => total + state.controllers.reduce((sum, controller) => sum + controller.triggers.length, 0), 0);

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
  return [
    'CNS機能の対応状況です。数字は、このキャラのCNS内で出てきた回数です。',
    `StateDef: ${diagnostics.stateCount}`,
    `Controller使用回数: ${diagnostics.controllerCount} / 種類: ${diagnostics.controllers.length}`,
    `Trigger使用回数: ${diagnostics.triggerCount} / 種類: ${diagnostics.triggers.length}`,
    '',
    'Controllers:',
    `  対応済み: ${countByStatus(diagnostics.controllers, 'supported')}種類`,
    ...formatCoverageItems(diagnostics.controllers.filter((item) => item.status === 'supported')),
    `  一部対応: ${countByStatus(diagnostics.controllers, 'partial')}種類`,
    ...formatCoverageItems(diagnostics.controllers.filter((item) => item.status === 'partial')),
    `  未対応: ${countByStatus(diagnostics.controllers, 'unsupported')}種類`,
    ...formatCoverageItems(diagnostics.unsupportedControllers),
    '',
    'Triggers:',
    `  対応済み: ${countByStatus(diagnostics.triggers, 'supported')}種類`,
    ...formatCoverageItems(diagnostics.triggers.filter((item) => item.status === 'supported')),
    `  一部対応: ${countByStatus(diagnostics.triggers, 'partial')}種類`,
    ...formatCoverageItems(diagnostics.triggers.filter((item) => item.status === 'partial')),
    `  未対応: ${countByStatus(diagnostics.triggers, 'unsupported')}種類`,
    ...formatCoverageItems(diagnostics.unsupportedTriggers),
  ];
}

function countByStatus(items: ReadonlyArray<{ status: CnsCoverageStatus }>, status: CnsCoverageStatus): number {
  return items.filter((item) => item.status === status).length;
}

function formatCoverageItems(items: ReadonlyArray<{ name: string; count: number }>): string[] {
  if (items.length === 0) return ['  -'];
  return items
    .slice()
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .map((item) => `    ${item.name}: ${item.count}`);
}

function normalizeControllerName(controller: CnsStateController): string {
  return controller.type.trim().toLowerCase() || '(missing-type)';
}

function classifyControllerStatus(name: string): CnsCoverageStatus {
  if (SUPPORTED_CONTROLLERS.has(name)) return 'supported';
  if (PARTIAL_CONTROLLERS.has(name)) return 'partial';
  return 'unsupported';
}

function classifyTrigger(expression: string): string {
  const trimmed = normalizeTriggerExpression(expression);
  for (const entry of SUPPORTED_TRIGGER_PATTERNS) if (entry.pattern.test(trimmed)) return entry.name;
  for (const entry of PARTIAL_TRIGGER_PATTERNS) if (entry.pattern.test(trimmed)) return entry.name;
  const name = readTriggerFeatureName(trimmed);
  return name ?? '(unknown)';
}

function classifyTriggerStatus(expression: string): CnsCoverageStatus {
  const trimmed = normalizeTriggerExpression(expression);
  if (SUPPORTED_TRIGGER_PATTERNS.some((entry) => entry.pattern.test(trimmed))) return 'supported';
  if (PARTIAL_TRIGGER_PATTERNS.some((entry) => entry.pattern.test(trimmed))) return 'partial';
  const name = readTriggerFeatureName(trimmed);
  if (name && SUPPORTED_TRIGGER_NAMES.has(name)) return 'supported';
  if (name && PARTIAL_TRIGGER_NAMES.has(name)) return 'partial';
  return 'unsupported';
}

function normalizeTriggerExpression(expression: string): string {
  let trimmed = expression.trim().toLowerCase().replace(/\s+/g, ' ');
  while (trimmed.startsWith('!')) trimmed = trimmed.slice(1).trim();
  let changed = true;
  while (changed) {
    changed = false;
    if (isWrappedInOuterParentheses(trimmed)) {
      trimmed = trimmed.slice(1, -1).trim();
      changed = true;
    }
  }
  return trimmed;
}

function readTriggerFeatureName(expression: string): string | null {
  const redirected = expression.match(/^(enemynear|enemy|target|parent|root|helper)\s*,/i);
  if (redirected) return redirected[1].toLowerCase();

  const functionMatch = expression.match(/^([a-z_][a-z0-9_]*)\s*\(/i);
  if (functionMatch) {
    const name = functionMatch[1].toLowerCase();
    if (name.startsWith('projhittime')) return 'projhittime';
    if (name.startsWith('projhit')) return 'projhit';
    return name;
  }

  const projCompact = expression.match(/^(projhit)\d+\b/i);
  if (projCompact) return 'projhit';

  const spaced = expression.match(/^([a-z_][a-z0-9_]*)(?:\s+([xy]))?/i);
  if (!spaced) {
    const nested = expression.match(/\b([a-z_][a-z0-9_]*)\b/i);
    return nested?.[1].toLowerCase() ?? null;
  }
  const root = spaced[1].toLowerCase();
  const axis = spaced[2]?.toLowerCase();
  if ((root === 'p2bodydist' || root === 'p2dist' || root === 'pos' || root === 'vel') && axis) return root;
  if ((root === 'backedgebodydist' || root === 'frontedgebodydist') && axis) return root;
  return root;
}

function isWrappedInOuterParentheses(expression: string): boolean {
  if (!expression.startsWith('(') || !expression.endsWith(')')) return false;
  let depth = 0;
  let inQuote = false;
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index];
    if (char === '"') inQuote = !inQuote;
    if (inQuote) continue;
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && index < expression.length - 1) return false;
  }
  return depth === 0;
}

function mergeCoverageStatus(a: CnsCoverageStatus, b: CnsCoverageStatus): CnsCoverageStatus {
  if (a === 'unsupported' || b === 'unsupported') return 'unsupported';
  if (a === 'partial' || b === 'partial') return 'partial';
  return 'supported';
}

function sortCoverageByStatusThenName<T extends { status: CnsCoverageStatus; name: string }>(a: T, b: T): number {
  const statusOrder: Record<CnsCoverageStatus, number> = { unsupported: 0, partial: 1, supported: 2 };
  return statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name);
}
