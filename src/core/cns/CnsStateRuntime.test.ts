import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('CnsStateRuntime', () => {
  it('records afterStateNo after ChangeState', () => {
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
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(state, cns);

    expect(result.state.players[0].stateNo).toBe(200);
    expect(result.traces[0]).toMatchObject({
      stateNo: 0,
      afterStateNo: 200,
      executedControllers: ['ChangeState'],
    });
  });

  it('does not run controller when grouped trigger is partly false', () => {
    const cns = parseCnsText(`
[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0

[State 0, ChangeState]
type = ChangeState
trigger1 = ctrl
trigger1 = command = "x"
value = 200
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(state, cns);

    expect(result.state.players[0].stateNo).toBe(0);
    expect(result.traces[0].afterStateNo).toBe(0);
  });

  it('runs controller when grouped trigger is true', () => {
    const cns = parseCnsText(`
[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0

[State 0, ChangeState]
type = ChangeState
trigger1 = ctrl
trigger1 = command = "x"
value = 200
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(state, cns, {
      p1Commands: new Set(['x']),
    });

    expect(result.state.players[0].stateNo).toBe(200);
    expect(result.traces[0].afterStateNo).toBe(200);
  });
});
