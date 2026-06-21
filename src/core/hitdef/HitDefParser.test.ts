import { describe, expect, it } from 'vitest';
import { parseHitDefController } from './HitDefParser';

describe('Phase67 HitDefParser', () => {
  it('parses common HitDef parameters', () => {
    const spec = parseHitDefController({
      type: 'HitDef',
      triggers: [],
      params: {
        attr: 'S, NA',
        damage: '23, 4',
        pausetime: '8, 10',
        'ground.velocity': '-4, -2',
        'guard.velocity': '-2, 0',
        priority: 5,
        sparkno: 2,
        guardsparkno: 40,
      },
    });

    expect(spec).toMatchObject({
      attr: { stateType: 'S', category: 'NA' },
      damage: { hit: 23, guard: 4 },
      pause: { attacker: 8, defender: 10 },
      hitVelocity: { x: -4, y: -2 },
      guardVelocity: { x: -2, y: 0 },
      priority: 5,
      sparkNo: 2,
      guardSparkNo: 40,
    });
  });

  it('returns null for non-HitDef controllers', () => {
    expect(parseHitDefController({ type: 'VelSet', triggers: [], params: {} })).toBeNull();
  });
});
