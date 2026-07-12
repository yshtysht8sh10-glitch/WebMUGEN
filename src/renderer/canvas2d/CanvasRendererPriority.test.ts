import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../core/engine/GameState';
import { getPlayersInSpritePriorityOrder } from './CanvasRenderer';

describe('CanvasRenderer sprite priority', () => {
  it('draws the higher runtime sprPriority later and preserves P1/P2 order for ties', () => {
    const state = createInitialGameState();
    expect(getPlayersInSpritePriorityOrder(state).map((player) => player.id)).toEqual([1, 2]);
    expect(getPlayersInSpritePriorityOrder({
      ...state,
      players: [{ ...state.players[0], sprPriority: 7 }, { ...state.players[1], sprPriority: 3 }],
    }).map((player) => player.id)).toEqual([2, 1]);
  });
});
