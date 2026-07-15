import { describe, expect, it } from 'vitest';
import { classifyHitDefParam, summarizeHitDefCoverage } from './HitDefCoverage';

describe('Phase71 HitDefCoverage', () => {
  it('classifies HitDef parameters', () => {
    expect(classifyHitDefParam('damage')).toEqual({ name: 'damage', status: 'supported' });
    expect(classifyHitDefParam('attr')).toEqual({ name: 'attr', status: 'partial' });
    expect(classifyHitDefParam('guard.pausetime')).toEqual({ name: 'guard.pausetime', status: 'partial' });
    expect(classifyHitDefParam('nochainid')).toEqual({ name: 'nochainid', status: 'partial' });
    expect(classifyHitDefParam('fall.recover')).toEqual({ name: 'fall.recover', status: 'partial' });
    expect(classifyHitDefParam('fall.envshake.time')).toEqual({ name: 'fall.envshake.time', status: 'partial' });
    expect(classifyHitDefParam('kill')).toEqual({ name: 'kill', status: 'partial' });
    expect(classifyHitDefParam('getpower')).toEqual({ name: 'getpower', status: 'partial' });
    expect(classifyHitDefParam('ground.cornerpush.veloff')).toEqual({ name: 'ground.cornerpush.veloff', status: 'partial' });
    expect(classifyHitDefParam('snap')).toEqual({ name: 'snap', status: 'partial' });
    expect(classifyHitDefParam('unknown.param')).toEqual({ name: 'unknown.param', status: 'unsupported' });
  });

  it('summarizes many params', () => {
    expect(summarizeHitDefCoverage(['attr', 'hitflag', 'envshake.time'])).toEqual([
      { name: 'attr', status: 'partial' },
      { name: 'hitflag', status: 'partial' },
      { name: 'envshake.time', status: 'partial' },
    ]);
  });
});
