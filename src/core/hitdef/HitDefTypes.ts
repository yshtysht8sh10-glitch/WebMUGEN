export type HitAttribute = {
  stateType: 'S' | 'C' | 'A' | 'Any';
  category: string;
};

export type HitDefDamage = {
  hit: number;
  guard: number;
};

export type HitDefPause = {
  attacker: number;
  defender: number;
};

export type HitDefVelocity = {
  x: number;
  y: number;
};

export type HitDefSpec = {
  attr: HitAttribute;
  damage: HitDefDamage;
  pause: HitDefPause;
  hitVelocity: HitDefVelocity;
  guardVelocity: HitDefVelocity;
  priority: number;
  sparkNo: number | null;
  guardSparkNo: number | null;
};

export function createDefaultHitDefSpec(): HitDefSpec {
  return {
    attr: { stateType: 'Any', category: 'NA' },
    damage: { hit: 0, guard: 0 },
    pause: { attacker: 0, defender: 0 },
    hitVelocity: { x: 0, y: 0 },
    guardVelocity: { x: 0, y: 0 },
    priority: 4,
    sparkNo: null,
    guardSparkNo: null,
  };
}
