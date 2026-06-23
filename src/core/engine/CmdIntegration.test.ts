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
    expect(state.players[0].stateNo).toBe(20);
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
});
