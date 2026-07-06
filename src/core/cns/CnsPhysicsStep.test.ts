import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsPhysicsMotion } from './CnsPhysicsStep';
import { parseCnsText } from '../../parser/cns/CnsParser';

describe('CnsPhysicsStep', () => {
  it('moves airborne players upward when jump velocity is negative', () => {
    const state = createInitialGameState();
    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        { ...state.players[0], stateNo: 40, stateType: 'A', physics: 'A', ctrl: false, vy: -8.4 },
        state.players[1],
      ],
    });

    expect(next.frame).toBe(1);
    expect(next.players[0].y).toBeLessThan(state.players[0].y);
    expect(next.players[0].vy).toBeCloseTo(-7.8);
    expect(next.players[0].stateTime).toBe(1);
    expect(next.players[0].animTime).toBe(1);
  });

  it('clamps falling air-physics players to ground without changing state', () => {
    const state = createInitialGameState();
    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        { ...state.players[0], stateNo: 50, stateType: 'A', physics: 'A', ctrl: false, y: 284, vy: 6 },
        state.players[1],
      ],
    });

    expect(next.players[0]).toMatchObject({
      stateNo: 50,
      y: 285,
      vy: 0,
      stateType: 'A',
      physics: 'A',
      ctrl: false,
    });
  });

  it('enters the CNS jump landing state after air physics reaches the ground', () => {
    const state = createInitialGameState();
    const cns = parseCnsText(`
[Statedef 52]
type = S
physics = S
ctrl = 0
anim = 47
`);

    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 50,
          stateType: 'A',
          physics: 'A',
          ctrl: true,
          y: 284,
          vy: 6,
          animNo: 42,
          animTime: 10,
        },
        state.players[1],
      ],
    }, cns);

    expect(next.players[0]).toMatchObject({
      stateNo: 52,
      stateTime: 0,
      stateType: 'S',
      physics: 'S',
      ctrl: false,
      animNo: 47,
      animTime: 0,
      y: 285,
      vy: 0,
    });
  });
});
