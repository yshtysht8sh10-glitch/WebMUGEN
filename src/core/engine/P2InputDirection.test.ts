import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from './GameState';
import { stepGameByCns } from './CnsGame';
import { sampleCharacterCns } from '../../app/sampleCharacterCns';

describe('P2 input direction', () => {
  it('moves P2 left when J is pressed', () => {
    const document = parseCnsText(sampleCharacterCns);
    let state = createInitialGameState();

    const originalX = state.players[1].x;

    state = stepGameByCns(state, document, {
      p1: { left: false, right: false, up: false, attack: false },
      p2: { left: true, right: false, up: false, attack: false },
    });

    state = stepGameByCns(state, document, {
      p1: { left: false, right: false, up: false, attack: false },
      p2: { left: true, right: false, up: false, attack: false },
    });

    expect(state.commandNames?.[1].has('holdback')).toBe(true);
    expect(state.players[1].x).toBeLessThan(originalX);
  });

  it('moves P2 right when L is pressed', () => {
    const document = parseCnsText(sampleCharacterCns);
    let state = createInitialGameState();

    const originalX = state.players[1].x;

    state = stepGameByCns(state, document, {
      p1: { left: false, right: false, up: false, attack: false },
      p2: { left: false, right: true, up: false, attack: false },
    });

    state = stepGameByCns(state, document, {
      p1: { left: false, right: false, up: false, attack: false },
      p2: { left: false, right: true, up: false, attack: false },
    });

    expect(state.commandNames?.[1].has('holdfwd')).toBe(true);
    expect(state.players[1].x).toBeGreaterThan(originalX);
  });
});
