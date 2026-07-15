import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { readCnsConst } from '../cns/CnsConstants';
import { evaluateCnsRuntimeTrigger } from '../cns/CnsRuntimeTrigger';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';

describe('Issue #52 power runtime regression', () => {
  it('uses [Data] power as powerMax while both players start independently at zero', () => {
    const cns = parseCnsText('[Data]\npower = 9000');
    const state = createInitialGameState(readCnsConst(cns, 'data.power'));

    expect(state.players.map((player) => ({ power: player.power, powerMax: player.powerMax }))).toEqual([
      { power: 0, powerMax: 9000 },
      { power: 0, powerMax: 9000 },
    ]);
    expect(evaluateCnsRuntimeTrigger('Power = 0', { player: state.players[0] })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('PowerMax = 9000', { player: state.players[0] })).toBe(true);
  });

  it('clamps PowerAdd and PowerSet to the current player powerMax without changing P2', () => {
    const cns = parseCnsText(`
[Statedef 200]
[State 200, Add]
type = PowerAdd
trigger1 = Time = 0
value = 200
[State 200, Set]
type = PowerSet
trigger1 = Time = 1
value = -50
`);
    const initial = createInitialGameState(9000);
    const atMax = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 200, power: 8950 }, { ...initial.players[1], power: 700 }],
    }, cns).state;
    const atZero = stepCnsStateRuntime({
      ...atMax,
      players: [{ ...atMax.players[0], stateTime: 1 }, atMax.players[1]],
    }, cns).state;

    expect(atMax.players[0].power).toBe(9000);
    expect(atZero.players[0].power).toBe(0);
    expect(atZero.players[1].power).toBe(700);
    expect(atMax.players[0].hitDiagnosticLines?.join('\n')).toContain('type=PowerAdd before=8950 value=200 after=9000 max=9000');
  });

  it('gates a command route by Power and consumes StateDef poweradd once per entry', () => {
    const cns = parseCnsText(`
[Statedef -1]
[State -1, Super]
type = ChangeState
triggerall = command = "super"
trigger1 = Power >= 1000
value = 3000

[Statedef 0]
type = S
ctrl = 1

[Statedef 3000]
type = S
ctrl = 0
poweradd = -1000
`);
    const initial = createInitialGameState(9000);
    const insufficient = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], power: 999 }, initial.players[1]],
    }, cns, { p1Commands: new Set(['super']) }).state;
    const entered = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], power: 1000 }, initial.players[1]],
    }, cns, { p1Commands: new Set(['super']) }).state;
    const stayed = stepCnsStateRuntime(entered, cns).state;

    expect(insufficient.players[0]).toMatchObject({ stateNo: 0, power: 999 });
    expect(entered.players[0]).toMatchObject({ stateNo: 3000, power: 0 });
    expect(stayed.players[0]).toMatchObject({ stateNo: 3000, power: 0 });
  });
});
