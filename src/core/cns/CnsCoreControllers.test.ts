import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('CNS core controllers phase49', () => {
  it('executes StateTypeSet', () => {
    const cns = parseCnsText(`
[Statedef 300]
type = S
movetype = I
physics = S
anim = 300

[State 300, Airborne]
type = StateTypeSet
trigger1 = 1
statetype = A
movetype = A
physics = A
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [{ ...state.players[0], stateNo: 300 }, state.players[1]],
      },
      cns,
    );

    expect(result.state.players[0]).toMatchObject({
      stateType: 'A',
      moveType: 'A',
      physics: 'A',
    });
    expect(result.traces[0].executedControllers).toEqual(['StateTypeSet']);
  });

  it('executes MoveTypeSet', () => {
    const cns = parseCnsText(`
[Statedef 301]
type = S
movetype = I
physics = S
anim = 301

[State 301, Attack]
type = MoveTypeSet
trigger1 = 1
value = A
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [{ ...state.players[0], stateNo: 301, moveType: 'I' }, state.players[1]],
      },
      cns,
    );

    expect(result.state.players[0].moveType).toBe('A');
    expect(result.traces[0].executedControllers).toEqual(['MoveTypeSet']);
  });

  it('executes LifeAdd and PowerAdd', () => {
    const cns = parseCnsText(`
[Statedef 302]
type = S
anim = 302

[State 302, Heal]
type = LifeAdd
trigger1 = 1
value = 25

[State 302, GainPower]
type = PowerAdd
trigger1 = 1
value = 100
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [{ ...state.players[0], stateNo: 302, life: 500, power: 10 }, state.players[1]],
      },
      cns,
    );

    expect(result.state.players[0].life).toBe(525);
    expect(result.state.players[0].power).toBe(110);
    expect(result.traces[0].executedControllers).toEqual(['LifeAdd', 'PowerAdd']);
  });

  it('executes VarSet and VarAdd', () => {
    const cns = parseCnsText(`
[Statedef 303]
type = S
anim = 303

[State 303, Set]
type = VarSet
trigger1 = 1
v = 3
value = 10

[State 303, Add]
type = VarAdd
trigger1 = 1
v = 3
value = 5
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [{ ...state.players[0], stateNo: 303, vars: {} }, state.players[1]],
      },
      cns,
    );

    expect(result.state.players[0].vars?.[3]).toBe(15);
    expect(result.traces[0].executedControllers).toEqual(['VarSet', 'VarAdd']);
  });

  it('supports float/system variable syntax and rejects invalid indexes without mutation', () => {
    const cns = parseCnsText(`
[Statedef 305]
type = S

[State 305, Float Set]
type = VarSet
trigger1 = 1
fv = 39
value = 1.25

[State 305, Float Add]
type = VarAdd
trigger1 = 1
fvar(39) = .5

[State 305, System Float]
type = VarSet
trigger1 = 1
sysfvar(4) = 2.5

[State 305, Invalid Int]
type = VarSet
trigger1 = 1
v = 60
value = 99
`);
    const state = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...state,
      players: [{ ...state.players[0], stateNo: 305 }, state.players[1]],
    }, cns);

    expect(result.state.players[0].fvars?.[39]).toBe(1.75);
    expect(result.state.players[0].sysFVars?.[4]).toBe(2.5);
    expect(result.state.players[0].vars?.[60]).toBeUndefined();
    expect(result.traces[0].executedControllers).toEqual(['VarSet', 'VarAdd', 'VarSet']);
  });

  it('applies VarRangeSet kind defaults and deterministic inclusive VarRandom ranges', () => {
    const cns = parseCnsText(`
[Statedef 306]
type = S

[State 306, Float Range]
type = VarRangeSet
trigger1 = 1
first = 38
fvalue = 2.5

[State 306, Random]
type = VarRandom
trigger1 = 1
v = 5
range = -2, 2
`);
    const state = createInitialGameState();
    const low = stepCnsStateRuntime({
      ...state,
      players: [{ ...state.players[0], stateNo: 306 }, state.players[1]],
    }, cns, { random: 0 }).state.players[0];
    const high = stepCnsStateRuntime({
      ...state,
      players: [{ ...state.players[0], stateNo: 306 }, state.players[1]],
    }, cns, { random: 999 }).state.players[0];

    expect(low.fvars?.[38]).toBe(2.5);
    expect(low.fvars?.[39]).toBe(2.5);
    expect(low.vars?.[5]).toBe(-2);
    expect(high.vars?.[5]).toBe(2);
  });

  it('does not reduce life or power below zero', () => {
    const cns = parseCnsText(`
[Statedef 304]
type = S
anim = 304

[State 304, Damage]
type = LifeAdd
trigger1 = 1
value = -9999

[State 304, Drain]
type = PowerAdd
trigger1 = 1
value = -9999
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [{ ...state.players[0], stateNo: 304, life: 100, power: 50 }, state.players[1]],
      },
      cns,
    );

    expect(result.state.players[0].life).toBe(0);
    expect(result.state.players[0].power).toBe(0);
  });
});
