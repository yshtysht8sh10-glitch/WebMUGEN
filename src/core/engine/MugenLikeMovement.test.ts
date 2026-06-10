import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from './GameState';
import { stepPlayerByCns } from './CnsStateMachine';
import { sampleCharacterCns } from '../../app/sampleCharacterCns';

describe('MUGEN-like movement sample', () => {
  it('keeps walking while holdfwd is pressed', () => {
    const document = parseCnsText(sampleCharacterCns);
    let player = createInitialGameState().players[0];

    player = stepPlayerByCns(player, document, {
      input: { left: false, right: true, up: false, attack: false },
      animLength: 60,
      moveHit: false,
    });

    expect(player.stateNo).toBe(20);

    player = stepPlayerByCns(player, document, {
      input: { left: false, right: true, up: false, attack: false },
      animLength: 60,
      moveHit: false,
    });

    expect(player.stateNo).toBe(20);
    expect(player.vx).toBe(2.2);
    expect(player.x).toBeGreaterThan(220);
  });

  it('can jump diagonally forward from stand', () => {
    const document = parseCnsText(sampleCharacterCns);
    let player = createInitialGameState().players[0];

    player = stepPlayerByCns(player, document, {
      input: { left: false, right: true, up: true, attack: false },
      animLength: 60,
      moveHit: false,
    });

    expect(player.stateNo).toBe(41);

    player = stepPlayerByCns(player, document, {
      input: { left: false, right: true, up: true, attack: false },
      animLength: 60,
      moveHit: false,
    });

    expect(player.vx).toBe(2.2);
    expect(player.vy).toBeLessThan(0);
  });

  it('returns to stand and stops horizontal velocity when walking input is released', () => {
    const document = parseCnsText(sampleCharacterCns);
    let player = {
      ...createInitialGameState().players[0],
      stateNo: 20,
      vx: 2.2,
    };

    player = stepPlayerByCns(player, document, {
      input: { left: false, right: false, up: false, attack: false },
      animLength: 60,
      moveHit: false,
    });

    expect(player.stateNo).toBe(0);

    player = stepPlayerByCns(player, document, {
      input: { left: false, right: false, up: false, attack: false },
      animLength: 60,
      moveHit: false,
    });

    expect(player.vx).toBe(0);
  });
});
