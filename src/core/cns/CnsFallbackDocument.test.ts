import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';
import { attachFallbackAttackStates } from './CnsFallbackDocument';

describe('CnsFallbackDocument', () => {
  it('creates fallback document when source CNS is missing', () => {
    const cns = attachFallbackAttackStates(null);

    expect(cns.states.some((state) => state.stateNo === 0)).toBe(true);
    expect(cns.states.some((state) => state.stateNo === 200)).toBe(true);
  });

  it('does not overwrite existing state numbers', () => {
    const source = parseCnsText(`
[Statedef 200]
type = S
movetype = I
physics = S
ctrl = 1
anim = 999
`);

    const cns = attachFallbackAttackStates(source);
    const states200 = cns.states.filter((state) => state.stateNo === 200);

    expect(states200).toHaveLength(1);
    expect(states200[0].initialAnim).toBe(999);
  });

  it('adds missing fallback states to existing CNS', () => {
    const source = parseCnsText(`
[Statedef 999]
type = S
anim = 999
`);

    const cns = attachFallbackAttackStates(source);

    expect(cns.states.some((state) => state.stateNo === 999)).toBe(true);
    expect(cns.states.some((state) => state.stateNo === 200)).toBe(true);
  });

  it('injects a fallback return controller into existing state 200', () => {
    const source = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S
ctrl = 0
anim = 200
`);

    const cns = attachFallbackAttackStates(source);
    const state200 = cns.states.find((state) => state.stateNo === 200);

    expect(state200?.controllers.some((controller) =>
      controller.type === 'ChangeState' &&
      controller.triggers.some((trigger) => trigger.expression === 'time > 18') &&
      controller.params.value === 0
    )).toBe(true);
  });

  it('uses injected fallback return controller at runtime', () => {
    const source = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S
ctrl = 0
anim = 200
`);

    const cns = attachFallbackAttackStates(source);
    const state = createInitialGameState();

    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 200, stateTime: 438, animNo: 200, moveType: 'A', ctrl: false },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0].stateNo).toBe(0);
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('does not duplicate return controller if state 200 already has ChangeState value 0', () => {
    const source = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S
ctrl = 0
anim = 200

[State 200, ExistingReturn]
type = ChangeState
trigger1 = time > 10
value = 0
`);

    const cns = attachFallbackAttackStates(source);
    const state200 = cns.states.find((state) => state.stateNo === 200);
    const returnControllers = state200?.controllers.filter((controller) =>
      controller.type.toLowerCase() === 'changestate' &&
      Number(controller.params.value) === 0
    );

    expect(returnControllers).toHaveLength(1);
  });
});
