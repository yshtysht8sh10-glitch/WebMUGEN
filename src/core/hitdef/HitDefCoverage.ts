export type HitDefCoverageItem = {
  name: string;
  status: 'supported' | 'partial' | 'unsupported';
};

const HITDEF_SUPPORTED_PARAMS = new Set([
  'damage',
  'animtype',
  'ground.hittime',
  'air.hittime',
  'sparkno',
  'guardsparkno',
]);

const HITDEF_PARTIAL_PARAMS = new Set([
  'attr',
  'air.animtype',
  'fall.animtype',
  'hitflag',
  'guardflag',
  'priority',
  'pausetime',
  'guard.pausetime',
  'ground.type',
  'air.type',
  'guard.hittime',
  'ground.velocity',
  'air.velocity',
  'guard.velocity',
  'fall',
  'fall.velocity',
  'fall.xvelocity',
  'fall.yvelocity',
  'fall.recover',
  'fall.recovertime',
  'fall.damage',
  'fall.kill',
  'id',
  'chainid',
  'nochainid',
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
