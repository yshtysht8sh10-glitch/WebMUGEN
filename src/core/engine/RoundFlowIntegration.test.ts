import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from './GameState';
import { applyRoundFlowStateEntries, winMugenRoundState } from './RoundFlow';
import { createInitialRoundState, stepRoundState } from './RoundState';

const cns = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[StateDef 170]
type = S
physics = N
anim = 170
ctrl = 0

[StateDef 175]
type = S
physics = N
anim = 175
ctrl = 0

[StateDef 180]
type = S
physics = N
anim = 180
ctrl = 0

[StateDef 190]
type = S
physics = N
ctrl = 0
[State 190, Intro]
type = ChangeState
trigger1 = Time = 0
value = 191

[StateDef 191]
type = S
physics = N
anim = 191
ctrl = 0
[State 191, Keep synchronized]
type = AssertSpecial
trigger1 = 1
flag = intro
[State 191, P1 finishes first]
type = ChangeState
trigger1 = ID = 1
trigger1 = Time >= 1
value = 0
[State 191, P2 finishes later]
type = ChangeState
trigger1 = ID = 2
trigger1 = Time >= 3
value = 0
`);

describe('Issue #93 production CNS Round Flow integration', () => {
  it('steps both Intro states and starts Fight only after the longer character finishes', () => {
    let state = createInitialGameState();
    let round = createInitialRoundState();
    state = applyRoundFlowStateEntries(state, round);

    let observedP1Waiting = false;
    for (let frame = 0; frame < 12 && round.phase === 'intro'; frame += 1) {
      state = stepCnsStateRuntime(state, cns, {
        p1Commands: new Set(), p2Commands: new Set(), roundState: winMugenRoundState(round),
      }).state;
      state = stepCnsPhysicsMotion(state, cns);
      round = stepRoundState(round, state);
      if (state.players[0].stateNo === 0 && state.players[1].stateNo === 191) {
        observedP1Waiting = true;
        expect(round.phase).toBe('intro');
      }
    }

    expect(observedP1Waiting).toBe(true);
    expect(round.phase).toBe('fight');
    expect(state.players.map((player) => player.stateNo)).toEqual([0, 0]);
  });

  it('applies the selected Win/Lose StateDef headers on the next result CNS pass', () => {
    const round = { ...createInitialRoundState(), phase: 'ko' as const, winner: 1 as const, endReason: 'ko' as const };
    const entered = applyRoundFlowStateEntries(createInitialGameState(), round);
    const stepped = stepCnsStateRuntime(entered, cns, { roundState: 3 }).state;
    expect(stepped.players[0]).toMatchObject({ stateNo: 180, animNo: 180, ctrl: false });
    expect(stepped.players[1]).toMatchObject({ stateNo: 170, animNo: 170, ctrl: false });
  });
});
