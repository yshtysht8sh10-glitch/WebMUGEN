import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('CnsStateRuntime AnimTime', () => {
  it('returns from state 200 when MUGEN AnimTime reaches 0', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S
ctrl = 0
anim = 200

[State 200, Return]
type = ChangeState
trigger1 = AnimTime = 0
value = 0
ctrl = 1

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
          { ...state.players[0], stateNo: 200, animNo: 200, animTime: 10, stateTime: 10, moveType: 'A', ctrl: false },
          state.players[1],
        ],
      },
      cns,
      {
        getAnimationDuration: (animNo) => (animNo === 200 ? 10 : null),
      },
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 0,
      animNo: 0,
      moveType: 'I',
      ctrl: true,
    });
    expect(result.traces[0]).toMatchObject({
      mugenAnimTime: 0,
      executedControllers: ['ChangeState'],
    });
  });

  it('does not return before MUGEN AnimTime reaches 0', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S
ctrl = 0
anim = 200

[State 200, Return]
type = ChangeState
trigger1 = AnimTime = 0
value = 0

[Statedef 0]
anim = 0
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 200, animNo: 200, animTime: 9, stateTime: 9 },
          state.players[1],
        ],
      },
      cns,
      {
        getAnimationDuration: (animNo) => (animNo === 200 ? 10 : null),
      },
    );

    expect(result.state.players[0].stateNo).toBe(200);
    expect(result.traces[0].mugenAnimTime).toBe(1);
  });
});
