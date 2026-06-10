import { describe, expect, it } from 'vitest';
import type { CnsStateController } from '../../mugen/common/cnsTypes';
import { createInitialGameState } from './GameState';
import { executeController } from './ControllerExecutor';

describe('Projectile Phase16', () => {
  it('creates projectile from Projectile controller', () => {
    const player = createInitialGameState().players[0];
    const controller: CnsStateController = {
      type: 'Projectile',
      triggers: [],
      params: {
        projid: 1000,
        projanim: 1100,
        offset: [56, -44],
        velocity: [5.5, 0],
        damage: [90, 20],
        pausetime: [4, 12],
        'ground.velocity': [-5, 0],
        'air.velocity': [-3, -6],
        removetime: 90,
      },
    };

    const result = executeController(player, controller);

    expect(result.projectiles).toHaveLength(1);
    expect(result.projectiles[0].x).toBe(player.x + 56);
    expect(result.projectiles[0].vx).toBe(5.5);
    expect(result.projectiles[0].hitDef.damage).toBe(90);
  });
});
