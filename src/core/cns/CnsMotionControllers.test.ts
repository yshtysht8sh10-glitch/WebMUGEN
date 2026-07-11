import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';
import { stepCnsPhysicsMotion } from './CnsPhysicsStep';

describe('CNS motion controllers', () => {
  const velSetCns = parseCnsText(`
[Statedef 101]
type = S
movetype = I
physics = N
ctrl = 0
anim = 101

[State 101, Dash]
type = VelSet
trigger1 = time = 0
x = 5
`);

  function stepVelSet(facing: 1 | -1, xValue = 5, noAutoTurn = false) {
    const cns = xValue === 5 && !noAutoTurn ? velSetCns : parseCnsText(`
[Statedef 101]
type = S
movetype = I
physics = N
ctrl = 0
anim = 101

${noAutoTurn ? `[State 101, Keep facing]\ntype = AssertSpecial\ntrigger1 = 1\nflag = noautoturn` : ''}

[State 101, Dash]
type = VelSet
trigger1 = time = 0
x = ${xValue}
`);
    const initial = createInitialGameState();
    const state = {
      ...initial,
      players: [{ ...initial.players[0], stateNo: 101, stateTime: 0, x: 300, facing }, initial.players[1]] as typeof initial.players,
    };
    const runtime = stepCnsStateRuntime(state, cns).state;
    return {
      runtime: runtime.players[0],
      moved: stepCnsPhysicsMotion(runtime, cns).players[0],
    };
  }

  it('moves right-facing VelSet x = 5 toward world right', () => {
    const result = stepVelSet(1);
    expect(result.runtime.vx).toBe(5);
    expect(result.moved.x).toBe(305);
  });

  it('moves left-facing VelSet x = 5 toward world left', () => {
    const result = stepVelSet(-1);
    expect(result.runtime.vx).toBe(-5);
    expect(result.moved.x).toBe(295);
  });

  it('moves VelSet x = -5 backward for both facings', () => {
    const facingRight = stepVelSet(1, -5);
    const facingLeft = stepVelSet(-1, -5);
    expect(facingRight.runtime.vx).toBe(-5);
    expect(facingRight.moved.x).toBe(295);
    expect(facingLeft.runtime.vx).toBe(5);
    expect(facingLeft.moved.x).toBe(305);
  });

  it('keeps NoAutoTurn velocity in the starting facing direction', () => {
    const result = stepVelSet(-1, 5, true);
    expect(result.runtime).toMatchObject({ vx: -5, facing: -1 });
    expect(result.moved.x).toBe(295);
  });

  it('applies Facing to VelAdd before VelMul scales world velocity', () => {
    const cns = parseCnsText(`
[Statedef 101]
type = S
physics = N

[State 101, Set]
type = VelSet
trigger1 = 1
x = 5

[State 101, Add]
type = VelAdd
trigger1 = 1
x = 1

[State 101, Multiply]
type = VelMul
trigger1 = 1
x = 2
`);
    const initial = createInitialGameState();
    const state = {
      ...initial,
      players: [{ ...initial.players[0], stateNo: 101, facing: -1 as const }, initial.players[1]],
    };

    const result = stepCnsStateRuntime(state, cns).state.players[0];

    expect(result.vx).toBe(-12);
  });

  it.each([
    { label: 'right-facing forward short jump', facing: 1 as const, initialVx: 2.5, expectedVx: 3.4 },
    { label: 'left-facing forward short jump', facing: -1 as const, initialVx: -2.5, expectedVx: -3.4 },
    { label: 'right-facing back short jump', facing: 1 as const, initialVx: -2.5, expectedVx: -3.6 },
    { label: 'left-facing back short jump', facing: -1 as const, initialVx: 2.5, expectedVx: 3.6 },
  ])('keeps $label moving in its relative direction', ({ facing, initialVx, expectedVx }) => {
    const cns = parseCnsText(`
[Statedef 50]
type = A
physics = A

[State 50, Short jump]
type = VelSet
trigger1 = time = 0
x = IfElse(vel x = 0, 0, IfElse(vel x < 0, -3.6, 3.4))
y = -6.4
`);
    const initial = createInitialGameState();
    const state = {
      ...initial,
      players: [{
        ...initial.players[0],
        stateNo: 50,
        stateTime: 0,
        stateType: 'A' as const,
        physics: 'A' as const,
        facing,
        vx: initialVx,
      }, initial.players[1]],
    };

    const result = stepCnsStateRuntime(state, cns).state.players[0];

    expect(result.vx).toBe(expectedVx);
  });

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
