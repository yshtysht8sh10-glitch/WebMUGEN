import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsPhysicsMotion } from './CnsPhysicsStep';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('StateDef anim entry compatibility', () => {
  it('restarts an explicitly declared animation even when the animation number is unchanged', () => {
    const cns = parseCnsText(`
[StateDef -1]
[State -1, explicit same anim]
type = ChangeState
trigger1 = command = "x"
value = 281

[StateDef 281]
type = A
physics = N
anim = 5012
`);
    const initial = createInitialGameState();
    const state = {
      ...initial,
      players: [
        { ...initial.players[0], stateNo: 280, animNo: 5012, animTime: 40 },
        initial.players[1],
      ] as typeof initial.players,
    };

    const entered = stepCnsStateRuntime(state, cns, { p1Commands: new Set(['x']) }).state.players[0];
    expect(entered).toMatchObject({ stateNo: 281, animNo: 5012, animTime: 0 });
  });

  it('preserves animation time when the destination StateDef omits anim', () => {
    const cns = parseCnsText(`
[StateDef -1]
[State -1, inherited anim]
type = ChangeState
trigger1 = command = "x"
value = 281

[StateDef 281]
type = A
physics = N
`);
    const initial = createInitialGameState();
    const state = {
      ...initial,
      players: [
        { ...initial.players[0], stateNo: 280, animNo: 5012, animTime: 40 },
        initial.players[1],
      ] as typeof initial.players,
    };

    const entered = stepCnsStateRuntime(state, cns, { p1Commands: new Set(['x']) }).state.players[0];
    expect(entered).toMatchObject({ stateNo: 281, animNo: 5012, animTime: 40 });
  });

  it('does not overwrite the bundled T-H-M-A State 102 ChangeAnim on the next tick', () => {
    const cns = parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.cns', 'utf8'));
    const initial = createInitialGameState();
    const state = {
      ...initial,
      players: [
        { ...initial.players[0], stateNo: 101, stateTime: 11, animNo: 101, animTime: 11 },
        initial.players[1],
      ] as typeof initial.players,
    };

    const entryResult = stepCnsStateRuntime(state, cns, { p1Commands: new Set() });
    const entered = entryResult.state;
    expect(entered.players[0]).toMatchObject({ stateNo: 102, prevStateNo: 101, stateTime: 0, animNo: 107, animTime: 0 });
    expect(entryResult.traces[0].executedControllers).not.toContain('Turn');

    const nextTick = stepCnsStateRuntime(stepCnsPhysicsMotion(entered, cns), cns, { p1Commands: new Set() }).state;
    expect(nextTick.players[0]).toMatchObject({ stateNo: 102, stateTime: 1, animNo: 107, animTime: 1 });
  });
});
