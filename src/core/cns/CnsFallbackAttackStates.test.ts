import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';
import { CNS_FALLBACK_ATTACK_STATES, appendCnsFallbackAttackStates } from './CnsFallbackAttackStates';

describe('CnsFallbackAttackStates', () => {
  it('contains basic attack states', () => {
    const cns = parseCnsText(CNS_FALLBACK_ATTACK_STATES);

    expect(cns.states.some((state) => state.stateNo === 0)).toBe(true);
    expect(cns.states.some((state) => state.stateNo === 20)).toBe(true);
    expect(cns.states.some((state) => state.stateNo === 200)).toBe(true);
  });

  it('changes from stand to attack by command x', () => {
    const cns = parseCnsText(CNS_FALLBACK_ATTACK_STATES);
    const state = createInitialGameState();

    const result = stepCnsStateRuntime(state, cns, {
      p1Commands: new Set(['x']),
    });

    expect(result.state.players[0].stateNo).toBe(200);
    expect(result.traces[0].executedControllers).toEqual(['ChangeState']);
  });

  it('applies attack statedef on next runtime step', () => {
    const cns = parseCnsText(CNS_FALLBACK_ATTACK_STATES);
    const state = createInitialGameState();

    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 200, animNo: 0, moveType: 'I', ctrl: true },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0]).toMatchObject({
      stateNo: 200,
      animNo: 200,
      moveType: 'A',
      ctrl: false,
    });
  });

  it('returns from attack to stand after time', () => {
    const cns = parseCnsText(CNS_FALLBACK_ATTACK_STATES);
    const state = createInitialGameState();

    const result = stepCnsStateRuntime(
      {
        ...state,
        players: [
          { ...state.players[0], stateNo: 200, stateTime: 19, animNo: 200, moveType: 'A', ctrl: false },
          state.players[1],
        ],
      },
      cns,
    );

    expect(result.state.players[0].stateNo).toBe(0);
  });

  it('appends fallback attack states to existing text', () => {
    const cns = parseCnsText(appendCnsFallbackAttackStates('[Statedef 999]\nanim = 999'));

    expect(cns.states.some((state) => state.stateNo === 999)).toBe(true);
    expect(cns.states.some((state) => state.stateNo === 200)).toBe(true);
  });
});
