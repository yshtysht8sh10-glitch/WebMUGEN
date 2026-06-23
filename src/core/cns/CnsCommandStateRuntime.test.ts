import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('CnsCommandStateRuntime', () => {
  it('runs Statedef -1 as a command state before the current state', () => {
    const cns = parseCnsText(`
[Statedef -1]

[State -1, QCF]
type = ChangeState
triggerall = command = "QCF_x"
trigger1 = statetype = S
trigger1 = ctrl
value = 1000

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0

[Statedef 1000]
type = S
movetype = A
physics = S
ctrl = 0
anim = 1000
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(state, cns, {
      p1Commands: new Set(['qcf_x']),
      p2Commands: new Set(),
    });

    expect(result.state.players[0]).toMatchObject({
      stateNo: 1000,
      animNo: 1000,
      moveType: 'A',
      ctrl: false,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('does not run Statedef -1 command controllers when triggerall fails', () => {
    const cns = parseCnsText(`
[Statedef -1]

[State -1, QCF]
type = ChangeState
triggerall = command = "QCF_x"
trigger1 = statetype = S
trigger1 = ctrl
value = 1000

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime(state, cns, {
      p1Commands: new Set(['x']),
      p2Commands: new Set(),
    });

    expect(result.state.players[0].stateNo).toBe(0);
    expect(result.traces[0].executedControllers).not.toContain('ChangeState');
  });
});
