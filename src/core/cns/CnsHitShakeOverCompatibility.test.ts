import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const jechtSmashTargetStates = parseCnsText(`
[Statedef 3405]
type = A
movetype = H
physics = N
velset = 0,0

[State 3405, controlled target animation]
type = ChangeAnim2
trigger1 = 1
value = 3405

[State 3405, release after hit shake]
type = ChangeState
trigger1 = HitShakeOver = 1
value = 3406

[Statedef 3406]
type = A
movetype = H
physics = N
velset = -5,-20
`);

describe('WinMUGEN HitShakeOver numeric-boolean compatibility', () => {
  it('releases a Jecht-style custom target State when defender hit-shake ends', () => {
    const initial = createInitialGameState();
    const frozen = {
      ...initial,
      players: [
        initial.players[0],
        {
          ...initial.players[1],
          stateNo: 3405,
          stateHeaderAppliedStateNo: 3405,
          stateTime: 12,
          animNo: 3405,
          animTime: 12,
          hitPause: 1,
        },
      ] as typeof initial.players,
    };

    const duringShake = stepCnsStateRuntime(frozen, jechtSmashTargetStates);
    expect(duringShake.state.players[1]).toMatchObject({ stateNo: 3405, hitPause: 1 });

    const released = stepCnsStateRuntime({
      ...frozen,
      players: [frozen.players[0], { ...frozen.players[1], hitPause: 0 }] as typeof frozen.players,
    }, jechtSmashTargetStates);
    expect(released.state.players[1]).toMatchObject({
      stateNo: 3406,
      stateTime: 0,
      vx: 5,
      vy: -20,
    });
    expect(released.traces[1].executedControllers).toContain('ChangeState');
  });
});
