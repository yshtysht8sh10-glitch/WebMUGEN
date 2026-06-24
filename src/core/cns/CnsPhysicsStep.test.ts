import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsPhysicsMotion } from './CnsPhysicsStep';

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

  it('clamps falling airborne players back to ground when no CNS document is available', () => {
    const state = createInitialGameState();
    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        { ...state.players[0], stateType: 'A', physics: 'A', ctrl: false, y: 284, vy: 6 },
        state.players[1],
      ],
    });

    expect(next.players[0]).toMatchObject({
      y: 285,
      vy: 0,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
    });
  });

  it('transitions common jump state 50 to landing state 52 on ground contact', () => {
    const cns = parseCnsText(`
[Statedef 50]
type = A
movetype = I
physics = A
anim = 40
ctrl = 0

[Statedef 52]
type = S
movetype = I
physics = S
anim = 47
ctrl = 0
`);
    const state = createInitialGameState();
    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 50,
          stateTime: 32,
          animNo: 40,
          animTime: 32,
          stateType: 'A',
          physics: 'A',
          ctrl: false,
          y: 284,
          vy: 6,
        },
        state.players[1],
      ],
    }, cns);

    expect(next.players[0]).toMatchObject({
      stateNo: 52,
      stateTime: 0,
      animNo: 47,
      animTime: 0,
      y: 285,
      vy: 0,
      stateType: 'S',
      physics: 'S',
      ctrl: false,
    });
  });
});
