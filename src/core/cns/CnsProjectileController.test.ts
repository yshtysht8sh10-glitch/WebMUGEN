import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import type { ProjectileState } from '../engine/types';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('CnsStateRuntime Projectile controller', () => {
  it('emits a production projectile with Facing-relative velocity, acceleration, and HitDef data', () => {
    const cns = parseCnsText(`
[Statedef 1000]
type = S
movetype = A
physics = S
[State 1000, Projectile]
type = Projectile
trigger1 = 1
projID = 1000
projanim = 15201
projscale = .5, .75
velocity = .1, 0
accel = .2, .05
projremovetime = 60
damage = 40, 10
pausetime = 12, 8
ground.velocity = -20, -8
air.velocity = -15, -6
`);
    const state = createInitialGameState();
    state.players[0] = { ...state.players[0], stateNo: 1000, facing: -1 };
    const emitted: ProjectileState[] = [];

    const result = stepCnsStateRuntime(state, cns, { onProjectileCreate: (projectile) => emitted.push(projectile) });

    expect(result.traces[0].executedControllers).toContain('Projectile');
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      id: 1000, ownerId: 1, animNo: 15201, facing: -1,
      vx: -0.1, vy: 0, ax: -0.2, ay: 0.05,
      removeTime: 60, scaleX: 0.5, scaleY: 0.75,
      hitDef: {
        damage: 40, guardDamage: 10,
        pauseTime: { attacker: 12, defender: 8 },
        groundVelocity: { x: -20, y: -8 },
        airVelocity: { x: -15, y: -6 },
      },
    });
  });
});
