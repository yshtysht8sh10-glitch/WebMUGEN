import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { evaluateTriggerAsBoolean } from './TriggerEvaluator';
import { parseTriggerExpression } from '../../parser/cns/TriggerParser';

describe('evaluateTriggerAsBoolean', () => {
  it('evaluates time expression', () => {
    const player = createInitialGameState().players[0];

    expect(
      evaluateTriggerAsBoolean(parseTriggerExpression('time = 0'), {
        player,
        input: { left: false, right: false, attack: false },
        animLength: 10,
        moveHit: false,
      }),
    ).toBe(true);
  });

  it('evaluates command expression', () => {
    const player = createInitialGameState().players[0];

    expect(
      evaluateTriggerAsBoolean(parseTriggerExpression('command = "holdfwd"'), {
        player,
        input: { left: false, right: true, attack: false },
        animLength: 10,
        moveHit: false,
      }),
    ).toBe(true);
  });

  it('evaluates command names case-insensitively', () => {
    const player = createInitialGameState().players[0];

    expect(
      evaluateTriggerAsBoolean(parseTriggerExpression('command = "QCF_A"'), {
        player,
        input: {
          left: false,
          right: false,
          attack: false,
          commandNames: new Set(['qcf_a']),
        },
        animLength: 10,
        moveHit: false,
      }),
    ).toBe(true);
  });

  it('evaluates ctrl shorthand', () => {
    const player = createInitialGameState().players[0];

    expect(
      evaluateTriggerAsBoolean(parseTriggerExpression('ctrl'), {
        player,
        input: { left: false, right: false, attack: false },
        animLength: 10,
        moveHit: false,
      }),
    ).toBe(true);
  });

  it('evaluates animtime = 0 when animation has ended', () => {
    const player = {
      ...createInitialGameState().players[0],
      animTime: 10,
    };

    expect(
      evaluateTriggerAsBoolean(parseTriggerExpression('animtime = 0'), {
        player,
        input: { left: false, right: false, attack: false },
        animLength: 10,
        moveHit: false,
      }),
    ).toBe(true);
  });
});
