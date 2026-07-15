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
  'guard.sparkno',
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
  'guard.dist',
  'guard.damage',
  'guard.kill',
  'kill',
  'getpower',
  'givepower',
  'numhits',
  'ground.cornerpush.veloff',
  'air.cornerpush.veloff',
  'down.cornerpush.veloff',
  'guard.cornerpush.veloff',
  'airguard.cornerpush.veloff',
  'snap',
  'p1sprpriority',
  'p2sprpriority',
  'p1stateno',
  'p2stateno',
  'p2getp1state',
  'forcestand',
  'sparkxy',
  'hitsound',
  'guardsound',
  'envshake.time',
  'envshake.freq',
  'envshake.ampl',
  'envshake.phase',
  'hitonce',
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
  'fall.envshake.time',
  'fall.envshake.freq',
  'fall.envshake.ampl',
  'fall.envshake.phase',
  'down.velocity',
  'down.hittime',
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
