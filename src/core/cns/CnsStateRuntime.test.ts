import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('CnsStateRuntime', () => {
  it('applies destination StateDef header immediately after ChangeState', () => {
    const cns = parseCnsText(`
[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0

[State 0, ChangeState]
type = ChangeState
trigger1 = 1
value = 200

[Statedef 200]
type = S
movetype = A
physics = S
ctrl = 0
anim = 200
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(state, cns);

    expect(result.state.players[0]).toMatchObject({
      stateNo: 200,
      stateTime: 0,
      animNo: 200,
      moveType: 'A',
      ctrl: false,
    });
    expect(result.traces[0]).toMatchObject({
      stateNo: 0,
      afterStateNo: 200,
      animNo: 0,
      afterAnimNo: 200,
      stateTime: 0,
      afterStateTime: 0,
      executedControllers: ['ChangeState'],
    });
  });

  it('preserves stateTime while staying in the same StateDef', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S
ctrl = 0
anim = 200

[State 200, Return]
type = ChangeState
trigger1 = time > 18
value = 0

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 200, stateTime: 10, animNo: 200, animTime: 10 },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0].stateNo).toBe(200);
    expect(result.state.players[0].stateTime).toBe(10);
    expect(result.state.players[0].animTime).toBe(10);
    expect(result.traces[0].afterStateTime).toBe(10);
  });

  it('returns from state 200 when time condition is true', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S
ctrl = 0
anim = 200

[State 200, Return]
type = ChangeState
trigger1 = time > 18
value = 0

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 200, stateTime: 19, animNo: 200, animTime: 19, moveType: 'A', ctrl: false },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 0,
      stateTime: 0,
      animNo: 0,
      moveType: 'I',
      ctrl: true,
    });
    expect(result.traces[0]).toMatchObject({
      stateNo: 200,
      afterStateNo: 0,
      stateTime: 19,
      afterStateTime: 0,
      executedControllers: ['ChangeState'],
    });
  });
});
