import { describe, expect, it } from 'vitest';
import type { CnsStateController } from '../../mugen/common/cnsTypes';
import { createInitialGameState } from './GameState';
import { executeController } from './ControllerExecutor';
import { resolveSimpleHits } from './SimpleCollision';

describe('HitDef Phase8', () => {
  it('creates active HitDef from CNS controller params', () => {
    const player = createInitialGameState().players[0];
    const controller: CnsStateController = {
      type: 'HitDef',
      triggers: [],
      params: {
        damage: [80, 10],
        pausetime: [4, 10],
        'ground.velocity': [-4, 0],
        'air.velocity': [-2.5, -5.5],
      },
    };

    const result = executeController(player, controller);

    expect(result.player.activeHitDef?.damage).toBe(80);
    expect(result.player.activeHitDef?.guardDamage).toBe(10);
    expect(result.player.activeHitDef?.pauseTime.attacker).toBe(4);
    expect(result.player.activeHitDef?.pauseTime.defender).toBe(10);
    expect(result.player.activeHitDef?.groundVelocity.x).toBe(-4);
    expect(result.player.activeHitDef?.airVelocity.y).toBe(-5.5);
  });

  it('uses active HitDef when attack hits', () => {
    const state = createInitialGameState();
    const p1 = {
      ...state.players[0],
      x: 220,
      stateNo: 200,
      animTime: 6,
      facing: 1 as const,
      activeHitDef: {
        damage: 80,
        guardDamage: 10,
        pauseTime: {
          attacker: 4,
          defender: 10,
        },
        groundVelocity: {
          x: -4,
          y: 0,
        },
        airVelocity: {
          x: -2.5,
          y: -5.5,
        },
      },
    };
    const p2 = {
      ...state.players[1],
      x: 270,
      life: 1000,
    };

    const result = resolveSimpleHits([p1, p2]);

    expect(result.hitEvents).toHaveLength(1);
    expect(result.players[1].life).toBe(920);
    expect(result.players[0].hitPause).toBe(4);
    expect(result.players[1].hitPause).toBe(10);
    expect(result.players[0].hitDefUsed).toBe(true);
  });

  it('does not hit repeatedly after HitDef is used', () => {
    const state = createInitialGameState();
    const p1 = {
      ...state.players[0],
      x: 220,
      stateNo: 200,
      animTime: 7,
      facing: 1 as const,
      hitDefUsed: true,
      activeHitDef: {
        damage: 80,
        guardDamage: 10,
        pauseTime: {
          attacker: 4,
          defender: 10,
        },
        groundVelocity: {
          x: -4,
          y: 0,
        },
        airVelocity: {
          x: -2.5,
          y: -5.5,
        },
      },
    };
    const p2 = {
      ...state.players[1],
      x: 270,
      life: 1000,
    };

    const result = resolveSimpleHits([p1, p2]);

    expect(result.hitEvents).toHaveLength(0);
    expect(result.players[1].life).toBe(1000);
  });
});
