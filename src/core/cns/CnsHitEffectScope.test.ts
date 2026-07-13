import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('HitDef effect scope expressions', () => {
  it('evaluates S/F and unprefixed animation and sound expressions on activation', () => {
    const cns = parseCnsText(`
[StateDef 200]
type = S
movetype = A
[State 200, HitDef]
type = HitDef
trigger1 = 1
sparkno = s100 + ifelse(1, 2, 0)
guard.sparkno = F40
hitsound = s5, 1 + 1
guardsound = 6, 3
`);
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 200 }, initial.players[1]],
    }, cns).state.players[0].activeHitDef;

    expect(result).toMatchObject({
      spark: { animNo: 102, scope: 'attacker' },
      guardSpark: { animNo: 40, scope: 'common' },
      hitSound: { group: 5, index: 2, scope: 'attacker' },
      guardSound: { group: 6, index: 3, scope: 'common' },
    });
  });
});
