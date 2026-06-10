import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from './GameState';
import { stepPlayerByCns } from './CnsStateMachine';

describe('stepPlayerByCns', () => {
  it('keeps stateTime at 0 immediately after ChangeState', () => {
    const document = parseCnsText(`
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

    const player = createInitialGameState().players[0];

    const nextPlayer = stepPlayerByCns(player, document, {
      input: { left: false, right: true, attack: false },
      animLength: 60,
      moveHit: false,
    });

    expect(nextPlayer.stateNo).toBe(20);
    expect(nextPlayer.stateTime).toBe(0);
    expect(nextPlayer.animNo).toBe(20);
  });

  it('executes VelSet on time 0 after entering a state', () => {
    const document = parseCnsText(`
[StateDef 20]
type = S
movetype = I
physics = S
anim = 20
ctrl = 1

[State 20, Move]
type = VelSet
trigger1 = time = 0
x = 2
y = 0
`);

    const player = {
      ...createInitialGameState().players[0],
      stateNo: 20,
      stateTime: 0,
      animNo: 20,
    };

    const nextPlayer = stepPlayerByCns(player, document, {
      input: { left: false, right: false, attack: false },
      animLength: 60,
      moveHit: false,
    });

    expect(nextPlayer.vx).toBe(2);
    expect(nextPlayer.x).toBe(player.x + 2);
    expect(nextPlayer.stateTime).toBe(1);
  });

  it('executes PosAdd', () => {
    const document = parseCnsText(`
[StateDef 200]
type = S
movetype = A
physics = S
anim = 200
ctrl = 0

[State 200, Step]
type = PosAdd
trigger1 = time = 0
x = 8
`);

    const player = {
      ...createInitialGameState().players[0],
      stateNo: 200,
      animNo: 200,
      ctrl: false,
    };

    const nextPlayer = stepPlayerByCns(player, document, {
      input: { left: false, right: false, attack: false },
      animLength: 18,
      moveHit: false,
    });

    expect(nextPlayer.x).toBe(player.x + 8);
  });
});
