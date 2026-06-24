import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import { InputBuffer } from '../../input/InputBuffer';
import { resolveCommands } from '../../input/CommandResolver';
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

  it('maps Up input to holdup and changes to jump state 40', () => {
    const cmd = parseCmdText(`
[Command]
name = "a"
command = a
`);
    const cns = parseCnsText(`
[Statedef -1]

[State -1, Jump]
type = ChangeState
triggerall = command = "holdup"
trigger1 = statetype = S
trigger1 = ctrl
value = 40

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0

[Statedef 40]
type = A
movetype = I
physics = A
ctrl = 0
anim = 40
`);

    const input = { left: false, right: false, up: true, down: false, attack: false };
    const buffer = new InputBuffer();
    buffer.push(input);
    const commands = resolveCommands(cmd, input, buffer).activeCommandNames;

    const result = stepCnsStateRuntime(createInitialGameState(), cns, {
      p1Commands: commands,
      p2Commands: new Set(),
    });

    expect(commands.has('holdup')).toBe(true);
    expect(result.state.players[0]).toMatchObject({
      stateNo: 40,
      animNo: 40,
      stateType: 'A',
      physics: 'A',
      ctrl: false,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('runs common-style jump trigger conditions and changes to state 40', () => {
    const cns = parseCnsText(`
[Statedef -1]

[State -1, Jump]
type = ChangeState
triggerall = command = "holdup"
triggerall = command != "holddown"
triggerall = alive
triggerall = roundstate = 2
triggerall = ailevel = 0
triggerall = var(59) = 0
trigger1 = statetype = S
trigger1 = ctrl
value = 40

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0

[Statedef 40]
type = A
movetype = I
physics = A
ctrl = 0
anim = 40
`);

    const result = stepCnsStateRuntime(createInitialGameState(), cns, {
      p1Commands: new Set(['holdup', 'up']),
      p2Commands: new Set(),
    });

    expect(result.state.players[0]).toMatchObject({
      stateNo: 40,
      animNo: 40,
      stateType: 'A',
      physics: 'A',
      ctrl: false,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });
});
