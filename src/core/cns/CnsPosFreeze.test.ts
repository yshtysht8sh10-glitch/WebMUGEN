import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsPhysicsMotion } from './CnsPhysicsStep';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const cns = parseCnsText(`
[Statedef 100]
type = A
physics = N
[State 100, keep moving]
type = PosFreeze
trigger1 = 1
value = 0

[Statedef 101]
type = A
physics = N
[State 101, default freeze]
type = PosFreeze
trigger1 = 1
`);

function playerIn(stateNo: number) {
  const state = createInitialGameState();
  return {
    ...state,
    players: [{ ...state.players[0], stateNo, stateTime: 1, physics: 'N' as const, vx: 3, vy: -2 }, state.players[1]] as typeof state.players,
  };
}

describe('PosFreeze controller', () => {
  it('leaves motion enabled for value=0', () => {
    const runtime = stepCnsStateRuntime(playerIn(100), cns).state;
    const moved = stepCnsPhysicsMotion(runtime, cns).players[0];
    expect(moved).toMatchObject({ x: 223, y: 283, vx: 3, vy: -2, positionFrozen: false });
  });

  it('defaults to true and freezes only its execution frame', () => {
    const runtime = stepCnsStateRuntime(playerIn(101), cns).state;
    expect(runtime.players[0].positionFrozen).toBe(true);
    const frozen = stepCnsPhysicsMotion(runtime, cns).players[0];
    expect(frozen).toMatchObject({ x: 220, y: 285, vx: 3, vy: -2, stateTime: 2, positionFrozen: false });
  });
});
