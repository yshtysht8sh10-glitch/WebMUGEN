import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import { createInitialGameState } from './GameState';
import { stepGameByCns } from './CnsGame';

describe('CMD integration', () => {
  const cns = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[State 0, Walk]
type = ChangeState
trigger1 = command = "holdfwd"
value = 20
ctrl = 1

[State 0, Special]
type = ChangeState
trigger1 = command = "QCF_x"
value = 300
ctrl = 1

[StateDef 11]
type = C
movetype = I
physics = C
anim = 11
ctrl = 1

[StateDef 20]
type = S
movetype = I
physics = S
anim = 20
ctrl = 1

[StateDef 300]
type = S
movetype = A
physics = S
anim = 300
ctrl = 0
`);

  const cmd = parseCmdText(`
[Command]
name = "holdfwd"
command = /$F

[Command]
name = "QCF_x"
command = ~D, DF, F, x
time = 20
`);

  it('evaluates CNS command trigger through CMD document', () => {
    const state = stepGameByCns(
      createInitialGameState(),
      cns,
      {
        p1: {
          left: false,
          right: true,
          up: false,
          attack: false,
        },
      },
      undefined,
      cmd,
    );

    expect(state.players[0].stateNo).toBe(20);
    expect(state.commandNames?.[0].has('holdfwd')).toBe(true);
  });

  it('keeps CMD input history in GameState and triggers buffered command moves', () => {
    let state = createInitialGameState();

    state = stepGameByCns(state, cns, {
      p1: { left: false, right: false, down: true, up: false, attack: false },
    }, undefined, cmd);
    expect(state.players[0].stateNo).toBe(11);

    state = stepGameByCns(state, cns, {
      p1: { left: false, right: true, down: true, up: false, attack: false },
    }, undefined, cmd);
    expect(state.players[0].stateNo).toBe(11);
    expect(state.commandNames?.[0].has('holdfwd')).toBe(true);

    state = stepGameByCns(state, cns, {
      p1: { left: false, right: true, down: false, up: false, attack: false },
    }, undefined, cmd);
    expect(state.players[0].stateNo).toBe(20);

    state = {
      ...state,
      players: [{ ...state.players[0], stateNo: 0, stateTime: 0, animNo: 0, ctrl: true }, state.players[1]],
    };

    state = stepGameByCns(state, cns, {
      p1: { left: false, right: false, down: false, up: false, attack: false, buttons: ['x'] },
    }, undefined, cmd);

    expect(state.players[0].stateNo).toBe(300);
    expect(state.commandNames?.[0].has('qcf_x')).toBe(true);
  });

  it('executes Statedef -1 command routes before the current state', () => {
    const commandStateCns = parseCnsText(`
[StateDef -1]

[State -1, CrouchRoute]
type = ChangeState
trigger1 = command = "holddown"
value = 123
ctrl = 1

[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 0

[StateDef 123]
type = C
movetype = I
physics = C
anim = 11
ctrl = 1
`);
    const commandStateCmd = parseCmdText(`
[Command]
name = "holddown"
command = /$D
`);
    const initial = createInitialGameState();

    const state = stepGameByCns(
      {
        ...initial,
        players: [{ ...initial.players[0], ctrl: false }, initial.players[1]],
      },
      commandStateCns,
      {
        p1: { left: false, right: false, down: true, up: false, attack: false },
      },
      undefined,
      commandStateCmd,
    );

    expect(state.players[0]).toMatchObject({
      stateNo: 123,
      animNo: 11,
      stateType: 'C',
      physics: 'C',
      ctrl: true,
    });
  });

  it('does not activate a double-QCF route from one held diagonal sequence', () => {
    const conflictCns = parseCnsText(`
[StateDef -1]

[State -1, Super]
type = ChangeState
trigger1 = command = "super"
value = 3300
ctrl = 1

[State -1, Normal]
type = ChangeState
trigger1 = command = "normal"
value = 1000
ctrl = 1

[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[StateDef 1000]
type = S
movetype = A
physics = S
anim = 1000
ctrl = 0

[StateDef 3300]
type = S
movetype = A
physics = S
anim = 3300
ctrl = 0
`);
    const conflictCmd = parseCmdText(`
[Command]
name = "super"
command = ~D, F, D, F, a
time = 25

[Command]
name = "normal"
command = ~D, DF, F, a
time = 25
`);
    let state = createInitialGameState();

    for (let frame = 0; frame < 13; frame += 1) {
      state = stepGameByCns(state, conflictCns, {
        p1: { left: false, right: false, down: true, up: false, attack: false },
      }, undefined, conflictCmd);
    }
    for (let frame = 0; frame < 4; frame += 1) {
      state = stepGameByCns(state, conflictCns, {
        p1: { left: false, right: true, down: true, up: false, attack: false },
      }, undefined, conflictCmd);
    }
    for (let frame = 0; frame < 2; frame += 1) {
      state = stepGameByCns(state, conflictCns, {
        p1: { left: false, right: true, down: false, up: false, attack: false },
      }, undefined, conflictCmd);
    }
    state = stepGameByCns(state, conflictCns, {
      p1: {
        left: false,
        right: true,
        down: false,
        up: false,
        attack: false,
        buttons: ['a'],
      },
    }, undefined, conflictCmd);

    expect(state.commandNames?.[0].has('normal')).toBe(true);
    expect(state.commandNames?.[0].has('super')).toBe(false);
    expect(state.players[0].stateNo).toBe(1000);
  });
});
