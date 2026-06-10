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

[StateDef 20]
type = S
movetype = I
physics = S
anim = 20
ctrl = 1
`);

  const cmd = parseCmdText(`
[Command]
name = "holdfwd"
command = /F
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
  });
});
