import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { getProjectileWorldBox, resolveProjectileHits, stepProjectiles } from './ProjectileSystem';
import type { ProjectileState } from '../engine/types';

function createProjectile(): ProjectileState {
  return {
    id: 1000,
    ownerId: 1,
    x: 420,
    y: 230,
    vx: 5,
    vy: 0,
    facing: 1,
    animNo: 1100,
    animTime: 0,
    lifeTime: 0,
    removeTime: 90,
    hitDef: {
      damage: 90,
      guardDamage: 20,
      pauseTime: { attacker: 4, defender: 12 },
      groundVelocity: { x: -5, y: 0 },
      airVelocity: { x: -3, y: -6 },
    },
    hitBox: {
      x: -12,
      y: -12,
      width: 24,
      height: 24,
    },
  };
}

describe('ProjectileSystem', () => {
  it('steps projectile position', () => {
    const projectile = { ...createProjectile(), ax: 0.5, ay: 0.25 };
    const result = stepProjectiles([projectile]);

    expect(result.projectiles[0].x).toBe(425);
    expect(result.projectiles[0].vx).toBe(5.5);
    expect(result.projectiles[0].vy).toBe(0.25);
    expect(result.projectiles[0].animTime).toBe(1);
    expect(result.projectiles[0].lifeTime).toBe(1);
  });

  it('mirrors and scales the projectile collision box with Facing', () => {
    const box = getProjectileWorldBox({
      ...createProjectile(), facing: -1, scaleX: 0.5, scaleY: 2,
      hitBox: { x: -5, y: -10, width: 50, height: 20 },
    });
    expect(box).toEqual({ x: 397.5, y: 210, width: 25, height: 40 });
  });

  it('removes projectile on hit', () => {
    const state = createInitialGameState();
    const projectile = createProjectile();

    const result = resolveProjectileHits(state.players, [projectile]);

    expect(result.hitEvents).toHaveLength(1);
    expect(result.projectiles).toHaveLength(0);
    expect(result.players[1].life).toBe(910);
    expect(result.players[1].stateNo).toBe(5000);
  });
});
