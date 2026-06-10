import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { createInitialGameState } from '../engine/GameState';
import { resolveClsnHits } from './CollisionResolver';

describe('resolveClsnHits', () => {
  const airDocument = parseAirText(`
Begin Action 0
Clsn2Default: 1
 Clsn2[0] = -16,-78,16,0
0,0, 0,0, 12

Begin Action 200
Clsn2Default: 1
 Clsn2[0] = -16,-78,16,0
Clsn1: 1
 Clsn1[0] = 22,-52,70,-38
200,0, 0,0, 8
`);

  it('uses AIR Clsn1 vs Clsn2 to resolve hit', () => {
    const state = createInitialGameState();

    const p1 = {
      ...state.players[0],
      x: 220,
      animNo: 200,
      animTime: 0,
      stateNo: 200,
      moveType: 'A' as const,
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
      animNo: 0,
      animTime: 0,
      life: 1000,
    };

    const result = resolveClsnHits([p1, p2], airDocument);

    expect(result.hitEvents).toHaveLength(1);
    expect(result.players[1].life).toBe(920);
    expect(result.players[1].stateNo).toBe(5000);
    expect(result.players[0].hitDefUsed).toBe(true);
  });

  it('does not hit when Clsn boxes do not overlap', () => {
    const state = createInitialGameState();

    const p1 = {
      ...state.players[0],
      x: 100,
      animNo: 200,
      animTime: 0,
      stateNo: 200,
      moveType: 'A' as const,
      facing: 1 as const,
    };

    const p2 = {
      ...state.players[1],
      x: 500,
      animNo: 0,
      animTime: 0,
      life: 1000,
    };

    const result = resolveClsnHits([p1, p2], airDocument);

    expect(result.hitEvents).toHaveLength(0);
    expect(result.players[1].life).toBe(1000);
  });

  it('does not hit without Clsn1 attack boxes', () => {
    const state = createInitialGameState();

    const p1 = {
      ...state.players[0],
      x: 220,
      animNo: 0,
      animTime: 0,
      stateNo: 0,
      moveType: 'A' as const,
      facing: 1 as const,
    };

    const p2 = {
      ...state.players[1],
      x: 230,
      animNo: 0,
      animTime: 0,
      life: 1000,
    };

    const result = resolveClsnHits([p1, p2], airDocument);

    expect(result.hitEvents).toHaveLength(0);
    expect(result.players[1].life).toBe(1000);
  });
});
