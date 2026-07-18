import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { activateMoveContact, advanceMoveContact, recordMoveContact, resetMoveContact } from './MoveContactState';

describe('MoveContactState', () => {
  it('distinguishes hit and guarded contact', () => {
    const player = createInitialGameState().players[0];
    expect(recordMoveContact(player, 1, 'hit').moveContact).toEqual({
      activeHitDefId: 1, contact: true, hit: true, guarded: false, elapsed: 1, hitCount: 1,
    });
    expect(recordMoveContact(player, 2, 'guarded').moveContact).toEqual({
      activeHitDefId: 2, contact: true, hit: false, guarded: true, elapsed: 1, hitCount: 0,
    });
  });

  it('retains the previous result and hit count across HitDef generations', () => {
    let player = recordMoveContact(createInitialGameState().players[0], 1, 'hit');
    player = activateMoveContact(player, 2);
    expect(player.moveContact).toEqual({
      activeHitDefId: 2, contact: true, hit: true, guarded: false, elapsed: 1, hitCount: 1,
    });
    player = recordMoveContact(player, 2, 'hit');
    expect(player.moveContact?.hitCount).toBe(2);
    expect(resetMoveContact(player).moveContact).toEqual({
      activeHitDefId: 2, contact: false, hit: false, guarded: false, elapsed: 0, hitCount: 2,
    });
  });

  it('increments the Move* value only on an unpaused game tick', () => {
    const hit = recordMoveContact(createInitialGameState().players[0], 1, 'hit');
    expect(advanceMoveContact(hit).moveContact?.elapsed).toBe(2);
  });
});
