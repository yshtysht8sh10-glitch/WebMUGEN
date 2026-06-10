import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from './GameState';
import { stepPlayerByCns } from './CnsStateMachine';

describe('movement phase6', () => {
  it('moves backward', () => {
    const document = parseCnsText(`
[StateDef 21]
type = S
movetype = I
physics = S
anim = 21
ctrl = 1

[State 21, Move]
type = VelSet
trigger1 = time = 0
x = -1.8
`);

    const player = {
      ...createInitialGameState().players[0],
      stateNo: 21,
    };

    const nextPlayer = stepPlayerByCns(player, document, {
      input: { left: true, right: false, attack: false },
      animLength: 60,
      moveHit: false,
    });

    expect(nextPlayer.vx).toBe(-1.8);
    expect(nextPlayer.x).toBe(player.x - 1.8);
  });

  it('applies gravity', () => {
    const document = parseCnsText(`
[StateDef 40]
type = A
movetype = I
physics = A
anim = 40
ctrl = 0

[State 40, Gravity]
type = Gravity
trigger1 = 1
`);

    const player = {
      ...createInitialGameState().players[0],
      stateNo: 40,
      stateType: 'A' as const,
      y: 200,
      vy: 1,
    };

    const nextPlayer = stepPlayerByCns(player, document, {
      input: { left: false, right: false, up: false, attack: false },
      animLength: 60,
      moveHit: false,
    });

    expect(nextPlayer.vy).toBeGreaterThan(1);
    expect(nextPlayer.y).toBeGreaterThan(player.y);
  });

  it('evaluates pos y trigger for landing', () => {
    const document = parseCnsText(`
[StateDef 40]
type = A
movetype = I
physics = A
anim = 40
ctrl = 0

[State 40, Land]
type = ChangeState
trigger1 = time > 0
trigger1 = pos y >= 285
value = 0
ctrl = 1
`);

    const player = {
      ...createInitialGameState().players[0],
      stateNo: 40,
      stateType: 'A' as const,
      stateTime: 1,
      y: 285,
      vy: 0,
      ctrl: false,
    };

    const nextPlayer = stepPlayerByCns(player, document, {
      input: { left: false, right: false, up: false, attack: false },
      animLength: 60,
      moveHit: false,
    });

    expect(nextPlayer.stateNo).toBe(0);
    expect(nextPlayer.ctrl).toBe(true);
  });
});
