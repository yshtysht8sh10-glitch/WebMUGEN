import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const cns = parseCnsText(`
[Statedef -1]

[State -1, Enter attack]
type = ChangeState
trigger1 = command = "attack"
value = 200

[Statedef 200]
type = S
movetype = A
physics = S
ctrl = 0

[State 200, Charge displayed juggle once]
type = VarAdd
trigger1 = 1
var(15) = 7
persistent = 0
`);

describe('CNS controller persistent parameter', () => {
  it('runs persistent = 0 only once while remaining in the same state', () => {
    const entered = stepCnsStateRuntime(createInitialGameState(), cns, {
      p1Commands: new Set(['attack']),
    }).state;
    expect(entered.players[0].vars?.[15]).toBe(7);

    const stayed = stepCnsStateRuntime(entered, cns).state;
    const stayedAgain = stepCnsStateRuntime(stayed, cns).state;
    expect(stayedAgain.players[0].vars?.[15]).toBe(7);
  });

  it('allows persistent = 0 to execute again after leaving and re-entering the state', () => {
    const entered = stepCnsStateRuntime(createInitialGameState(), cns, {
      p1Commands: new Set(['attack']),
    }).state;
    const left = {
      ...entered,
      players: [{ ...entered.players[0], stateNo: 0, stateTime: 0 }, entered.players[1]],
    } as typeof entered;

    const reentered = stepCnsStateRuntime(left, cns, {
      p1Commands: new Set(['attack']),
    }).state;
    expect(reentered.players[0].vars?.[15]).toBe(14);
  });
});
