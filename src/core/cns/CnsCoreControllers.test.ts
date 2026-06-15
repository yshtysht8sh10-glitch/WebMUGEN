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
