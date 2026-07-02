import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('CNS motion controllers', () => {
  it('executes VelAdd', () => {
    const cns = parseCnsText(`
[Statedef 100]
type = S
movetype = I
physics = S
ctrl = 0
anim = 100

[State 100, Accelerate]
type = VelAdd
trigger1 = 1
x = 0.5
y = -1
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 100, vx: 2, vy: 3 },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0].vx).toBe(2.5);
    expect(result.state.players[0].vy).toBe(2);
    expect(result.traces[0].executedControllers).toEqual(['VelAdd']);
  });

  it('executes PosAdd', () => {
    const cns = parseCnsText(`
[Statedef 101]
type = S
movetype = I
physics = S
ctrl = 0
anim = 101

[State 101, Nudge]
type = PosAdd
trigger1 = 1
x = 4
y = -2
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 101, x: 100, y: 200 },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0].x).toBe(104);
    expect(result.state.players[0].y).toBe(198);
    expect(result.traces[0].executedControllers).toEqual(['PosAdd']);
  });

  it('maps WinMUGEN PosSet y=0 to the internal ground y', () => {
    const cns = parseCnsText(`
[Statedef 101]
type = S
movetype = I
physics = S
ctrl = 0
anim = 101

[State 101, Ground]
type = PosSet
trigger1 = 1
y = 0
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 101, y: 140 },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0].y).toBe(285);
    expect(result.traces[0].executedControllers).toEqual(['PosSet']);
  });

  it('executes CtrlSet', () => {
    const cns = parseCnsText(`
[Statedef 102]
type = S
movetype = I
physics = S
ctrl = 0
anim = 102

[State 102, EnableCtrl]
type = CtrlSet
trigger1 = time > 3
value = 1
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 102, stateTime: 4, ctrl: false },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0].ctrl).toBe(true);
    expect(result.traces[0].executedControllers).toEqual(['CtrlSet']);
  });

  it('can combine motion controllers in order', () => {
    const cns = parseCnsText(`
[Statedef 103]
type = S
movetype = I
physics = S
ctrl = 0
anim = 103

[State 103, Set]
type = VelSet
trigger1 = 1
x = 1
y = 2

[State 103, Add]
type = VelAdd
trigger1 = 1
x = 3
y = -1

[State 103, Move]
type = PosAdd
trigger1 = 1
x = 5
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 103, vx: 0, vy: 0, x: 10 },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0].vx).toBe(4);
    expect(result.state.players[0].vy).toBe(1);
    expect(result.state.players[0].x).toBe(15);
    expect(result.traces[0].executedControllers).toEqual(['VelSet', 'VelAdd', 'PosAdd']);
  });
});
