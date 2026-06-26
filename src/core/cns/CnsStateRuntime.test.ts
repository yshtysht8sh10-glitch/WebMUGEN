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

  it('re-enters state 0 with idle animation even when the target StateDef omits anim', () => {
    const cns = parseCnsText(`
[Statedef 52]
type = S
movetype = I
physics = S
ctrl = 0
anim = 47

[State 52, EndLanding]
type = ChangeState
trigger1 = time > 5
value = 0

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          {
            ...state.players[0],
            stateNo: 52,
            animNo: 47,
            animTime: 96,
            stateTime: 96,
            stateType: 'S',
            moveType: 'I',
            physics: 'S',
            ctrl: false,
          },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 0,
      animNo: 0,
      animTime: 0,
      stateTime: 0,
      stateType: 'S',
      moveType: 'I',
      physics: 'S',
      ctrl: true,
    });
  });

  it('preserves the current animation when entering an animless non-idle state', () => {
    const cns = parseCnsText(`
[Statedef 40]
type = A
movetype = I
physics = A
ctrl = 0
anim = 40

[State 40, ToJumpUp]
type = ChangeState
trigger1 = time > 3
value = 50

[Statedef 50]
type = A
movetype = I
physics = A
ctrl = 0
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          {
            ...state.players[0],
            stateNo: 40,
            animNo: 40,
            animTime: 4,
            stateTime: 4,
            stateType: 'A',
            moveType: 'I',
            physics: 'A',
            ctrl: false,
          },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 50,
      animNo: 40,
      animTime: 4,
      stateTime: 0,
      stateType: 'A',
      moveType: 'I',
      physics: 'A',
      ctrl: false,
    });
  });
});
