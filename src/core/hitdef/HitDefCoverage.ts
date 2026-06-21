export type HitDefCoverageItem = {
  name: string;
  status: 'supported' | 'partial' | 'unsupported';
};

const HITDEF_SUPPORTED_PARAMS = new Set([
  'attr',
  'damage',
  'pausetime',
  'ground.velocity',
  'guard.velocity',
  'priority',
  'sparkno',
  'guardsparkno',
]);

const HITDEF_PARTIAL_PARAMS = new Set([
  'animtype',
  'air.animtype',
  'ground.type',
  'air.type',
  'fall',
  'fall.recover',
  'hitflag',
  'guardflag',
]);

export function classifyHitDefParam(name: string): HitDefCoverageItem {
  const key = name.trim().toLowerCase();

  if (HITDEF_SUPPORTED_PARAMS.has(key)) {
    return { name: key, status: 'supported' };
  }

  if (HITDEF_PARTIAL_PARAMS.has(key)) {
    return { name: key, status: 'partial' };
  }

  return { name: key, status: 'unsupported' };
}

export function summarizeHitDefCoverage(paramNames: readonly string[]): HitDefCoverageItem[] {
  return paramNames.map(classifyHitDefParam);
}
