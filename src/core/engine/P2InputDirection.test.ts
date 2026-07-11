import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from './GameState';
import { stepGameByCns } from './CnsGame';
import { sampleCharacterCns } from '../../app/sampleCharacterCns';

describe('P2 input direction', () => {
  it('treats physical left as forward while P2 faces left', () => {
    const document = parseCnsText(sampleCharacterCns);
    let state = createInitialGameState();

    state = stepGameByCns(state, document, {
      p1: { left: false, right: false, up: false, attack: false },
      p2: { left: true, right: false, up: false, attack: false },
    });

    state = stepGameByCns(state, document, {
      p1: { left: false, right: false, up: false, attack: false },
      p2: { left: true, right: false, up: false, attack: false },
    });

    expect(state.commandNames?.[1].has('holdfwd')).toBe(true);
  });

  it('treats physical right as back while P2 faces left', () => {
    const document = parseCnsText(sampleCharacterCns);
    let state = createInitialGameState();

    state = stepGameByCns(state, document, {
      p1: { left: false, right: false, up: false, attack: false },
      p2: { left: false, right: true, up: false, attack: false },
    });

    state = stepGameByCns(state, document, {
      p1: { left: false, right: false, up: false, attack: false },
      p2: { left: false, right: true, up: false, attack: false },
    });

    expect(state.commandNames?.[1].has('holdback')).toBe(true);
  });
});
