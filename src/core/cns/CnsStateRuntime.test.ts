import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('CnsStateRuntime', () => {
  it('returns missing traces without CNS document', () => {
    const state = createInitialGameState();
    const result = stepCnsStateRuntime(state, null);

    expect(result.state).toBe(state);
    expect(result.traces[0]).toMatchObject({
      playerId: 1,
      stateFound: false,
    });
  });

  it('applies StateDef header fields', () => {
    const cns = parseCnsText(`
[Statedef 20]
type = S
movetype = I
physics = S
ctrl = 1
anim = 20
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 20, animNo: 0, ctrl: false },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0]).toMatchObject({
      stateType: 'S',
      moveType: 'I',
      physics: 'S',
      ctrl: true,
      animNo: 20,
    });
    expect(result.traces[0].stateFound).toBe(true);
  });

  it('executes ChangeAnim and VelSet controllers', () => {
    const cns = parseCnsText(`
[Statedef 20]
type = S
movetype = I
physics = S
ctrl = 1
anim = 20

[State 20, ChangeAnim]
type = ChangeAnim
trigger1 = time = 0
value = 21

[State 20, VelSet]
type = VelSet
trigger1 = 1
x = 3
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 20, stateTime: 0, animNo: 0, vx: 0 },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0].animNo).toBe(21);
    expect(result.state.players[0].vx).toBe(3);
    expect(result.traces[0].executedControllers).toEqual(['ChangeAnim', 'VelSet']);
  });

  it('executes ChangeState controller', () => {
    const cns = parseCnsText(`
[Statedef 20]
type = S
movetype = I
physics = S
ctrl = 1
anim = 20

[State 20, ChangeState]
type = ChangeState
trigger1 = time > 5
value = 0
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 20, stateTime: 6 },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0].stateNo).toBe(0);
    expect(result.state.players[0].stateTime).toBe(0);
    expect(result.traces[0].executedControllers).toEqual(['ChangeState']);
  });

  it('does not run controller when trigger is false', () => {
    const cns = parseCnsText(`
[Statedef 20]
type = S
movetype = I
physics = S
ctrl = 1
anim = 20

[State 20, VelSet]
type = VelSet
trigger1 = time > 5
x = 3
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 20, stateTime: 0, vx: 0 },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0].vx).toBe(0);
    expect(result.traces[0].executedControllers).toEqual([]);
  });
});
