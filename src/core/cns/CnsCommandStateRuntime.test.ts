import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import { InputBuffer } from '../../input/InputBuffer';
import { resolveCommands } from '../../input/CommandResolver';
import { createInitialGameState } from '../engine/GameState';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';
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

  it('runs Statedef -2 common controllers before the current state', () => {
    const cns = parseCnsText(`
[Statedef -2]

[State -2, Common Land]
type = ChangeState
triggerall = physics = A
triggerall = vel y >= 0
trigger1 = pos y >= 0
value = 52

[Statedef 50]
type = A
movetype = I
physics = A
ctrl = 0
anim = 50

[Statedef 52]
type = S
movetype = I
physics = S
ctrl = 0
anim = 47
`);

    const state = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 50,
          stateType: 'A',
          physics: 'A',
          ctrl: false,
          y: DEFAULT_GROUND_Y,
          vy: 0,
        },
        state.players[1],
      ],
    }, cns, {
      p1Commands: new Set(),
      p2Commands: new Set(),
    });

    expect(result.state.players[0]).toMatchObject({
      stateNo: 52,
      animNo: 47,
      stateType: 'S',
      physics: 'S',
      ctrl: false,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
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

  it('keeps a simple attack command long enough to survive crouch startup routing', () => {
    const cmd = parseCmdText(`
[Command]
name = "a"
command = a
time = 1

[Command]
name = "holddown"
command = /$D
time = 1
`);
    const cns = parseCnsText(`
[Statedef -1]

[State -1, Common Crouch Start]
type = ChangeState
triggerall = command = "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 10

[State -1, Common Crouch Hold]
type = ChangeState
triggerall = command = "holddown"
trigger1 = stateno = 10
value = 11

[State -1, Crouch Attack]
type = ChangeState
triggerall = command = "a"
triggerall = command = "holddown"
trigger1 = statetype = C
trigger1 = ctrl
value = 430

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0

[Statedef 10]
type = C
movetype = I
physics = C
ctrl = 0
anim = 10

[Statedef 11]
type = C
movetype = I
physics = C
ctrl = 1
anim = 11

[Statedef 430]
type = C
movetype = A
physics = C
ctrl = 0
anim = 430
`);

    const buffer = new InputBuffer();
    const firstInput = { left: false, right: false, up: false, down: true, attack: false, buttons: ['a'] };
    buffer.push(firstInput);
    const firstCommands = resolveCommands(cmd, firstInput, buffer).activeCommandNames;
    const enteredCrouch = stepCnsStateRuntime(createInitialGameState(), cns, {
      p1Commands: firstCommands,
      p2Commands: new Set(),
    });

    const secondInput = { left: false, right: false, up: false, down: true, attack: false };
    buffer.push(secondInput);
    const secondCommands = resolveCommands(cmd, secondInput, buffer).activeCommandNames;
    const attacked = stepCnsStateRuntime(enteredCrouch.state, cns, {
      p1Commands: secondCommands,
      p2Commands: new Set(),
    });

    expect(enteredCrouch.state.players[0].stateNo).toBe(430);
    expect(secondCommands.has('a')).toBe(true);
    expect(attacked.state.players[0]).toMatchObject({
      stateNo: 430,
      animNo: 430,
      moveType: 'A',
    });
  });

  it('does not reuse the entry button press for a State 240 follow-up command', () => {
    const cmd = parseCmdText(`
[Command]
name = "b"
command = b
time = 1
`);
    const cns = parseCnsText(`
[Statedef -1]
[State -1, Start]
type = ChangeState
trigger1 = stateno = 0
trigger1 = command = "b"
value = 240

[State 240, ResetFollowup]
type = VarSet
trigger1 = stateno != 240
var(24) = 0

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0

[Statedef 240]
type = S
movetype = A
physics = S
ctrl = 0
anim = 240

[State 240, FollowupFlag]
type = VarSet
trigger1 = command = "b"
trigger1 = time >= 2
var(24) = 1

[State 240, Followup]
type = ChangeState
triggerall = var(24) = 1
trigger1 = time = 18
value = 241

[Statedef 241]
type = S
movetype = A
physics = S
ctrl = 0
anim = 241
`);

    const buffer = new InputBuffer(30);
    const firstInput = { left: false, right: false, up: false, down: false, attack: false, buttons: ['b'] };
    buffer.push(firstInput);
    let game = stepCnsStateRuntime(createInitialGameState(), cns, {
      p1Commands: resolveCommands(cmd, firstInput, buffer).activeCommandNames,
      p2Commands: new Set(),
    }).state;

    expect(game.players[0].stateNo).toBe(240);

    for (let time = 1; time <= 18; time += 1) {
      const heldInput = { left: false, right: false, up: false, down: false, attack: false, buttons: ['b'] };
      buffer.push(heldInput);
      game = {
        ...game,
        players: [{ ...game.players[0], stateTime: time }, game.players[1]],
      };
      game = stepCnsStateRuntime(game, cns, {
        p1Commands: resolveCommands(cmd, heldInput, buffer).activeCommandNames,
        p2Commands: new Set(),
      }).state;
    }

    expect(game.players[0].stateNo).toBe(240);
    expect((game.players[0] as { vars?: Record<number, number> }).vars?.[24]).toBe(0);

    const releaseInput = { left: false, right: false, up: false, down: false, attack: false };
    buffer.push(releaseInput);
    game = {
      ...game,
      players: [{ ...game.players[0], stateTime: 17 }, game.players[1]],
    };
    game = stepCnsStateRuntime(game, cns, {
      p1Commands: resolveCommands(cmd, releaseInput, buffer).activeCommandNames,
      p2Commands: new Set(),
    }).state;

    const repressInput = { left: false, right: false, up: false, down: false, attack: false, buttons: ['b'] };
    buffer.push(repressInput);
    game = {
      ...game,
      players: [{ ...game.players[0], stateTime: 18 }, game.players[1]],
    };
    game = stepCnsStateRuntime(game, cns, {
      p1Commands: resolveCommands(cmd, repressInput, buffer).activeCommandNames,
      p2Commands: new Set(),
    }).state;

    expect(game.players[0].stateNo).toBe(241);
  });

  it('keeps a jump attack button active until jump startup reaches air control', () => {
    const cmd = parseCmdText(`
[Command]
name = "a"
command = a
time = 1

[Command]
name = "holdup"
command = /$U
time = 1
`);
    const cns = parseCnsText(`
[Statedef -1]

[State -1, Jump]
type = ChangeState
triggerall = command = "holdup"
trigger1 = statetype = S
trigger1 = ctrl
value = 40

[State -1, Jump Attack]
type = ChangeState
triggerall = command = "a"
trigger1 = statetype = A
trigger1 = ctrl
value = 630

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0

[Statedef 40]
type = S
movetype = I
physics = S
ctrl = 0
anim = 40

[State 40, Rise]
type = ChangeState
trigger1 = time > 0
value = 50
ctrl = 1

[Statedef 50]
type = A
movetype = I
physics = A
ctrl = 1
anim = 50

[Statedef 630]
type = A
movetype = A
physics = A
ctrl = 0
anim = 630
`);

    const buffer = new InputBuffer();
    const firstInput = { left: false, right: false, up: true, down: false, attack: false, buttons: ['a'] };
    buffer.push(firstInput);
    let state = stepCnsStateRuntime(createInitialGameState(), cns, {
      p1Commands: resolveCommands(cmd, firstInput, buffer).activeCommandNames,
      p2Commands: new Set(),
    }).state;
    state = {
      ...state,
      players: [{ ...state.players[0], stateTime: 1 }, state.players[1]],
    };

    const secondInput = { left: false, right: false, up: false, down: false, attack: false };
    buffer.push(secondInput);
    state = stepCnsStateRuntime(state, cns, {
      p1Commands: resolveCommands(cmd, secondInput, buffer).activeCommandNames,
      p2Commands: new Set(),
    }).state;
    state = {
      ...state,
      players: [{ ...state.players[0], stateTime: 1 }, state.players[1]],
    };

    const thirdInput = { left: false, right: false, up: false, down: false, attack: false };
    buffer.push(thirdInput);
    const thirdCommands = resolveCommands(cmd, thirdInput, buffer).activeCommandNames;
    state = stepCnsStateRuntime(state, cns, {
      p1Commands: thirdCommands,
      p2Commands: new Set(),
    }).state;

    expect(thirdCommands.has('a')).toBe(true);
    expect(state).toMatchObject({
      players: [
        expect.objectContaining({
          stateNo: 630,
          animNo: 630,
          moveType: 'A',
        }),
        expect.anything(),
      ],
    });
  });
});
