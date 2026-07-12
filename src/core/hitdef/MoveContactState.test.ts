import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { activateMoveContact, recordMoveContact, resetMoveContact } from './MoveContactState';

describe('MoveContactState', () => {
  it('distinguishes hit and guarded contact', () => {
    const player = createInitialGameState().players[0];
    expect(recordMoveContact(player, 1, 'hit').moveContact).toEqual({
      activeHitDefId: 1, contact: true, hit: true, guarded: false, hitCount: 1,
    });
    expect(recordMoveContact(player, 2, 'guarded').moveContact).toEqual({
      activeHitDefId: 2, contact: true, hit: false, guarded: true, hitCount: 0,
    });
  });

  it('retains hit count across generations and resets only result flags', () => {
    let player = recordMoveContact(createInitialGameState().players[0], 1, 'hit');
    player = activateMoveContact(player, 2);
    player = recordMoveContact(player, 2, 'hit');
    expect(player.moveContact?.hitCount).toBe(2);
    expect(resetMoveContact(player).moveContact).toEqual({
      activeHitDefId: 2, contact: false, hit: false, guarded: false, hitCount: 2,
    });
  });
});
