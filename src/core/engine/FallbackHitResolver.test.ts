import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { createInitialGameState } from './GameState';
import { resolveFallbackHits } from './FallbackHitResolver';

const air = parseAirText(`
[Begin Action 0]
Clsn2Default: 1
 Clsn2[0] = -20,-80,20,0
0,0, 0,0, 5

[Begin Action 200]
Clsn2Default: 1
 Clsn2[0] = -20,-80,20,0
Clsn1: 1
 Clsn1[0] = 10,-60,70,-30
200,0, 0,0, 5
`);

describe('FallbackHitResolver', () => {
  it('applies fallback hit when attack Clsn overlaps body Clsn', () => {
    const state = createInitialGameState();
    const next = resolveFallbackHits(
      {
        ...state,
        players: [
          {
            ...state.players[0],
            x: 240,
            y: 285,
            facing: 1,
            stateNo: 200,
            animNo: 200,
            moveType: 'A',
            hitDefUsed: false,
          },
          {
            ...state.players[1],
            x: 290,
            y: 285,
            facing: -1,
            stateNo: 0,
            animNo: 0,
            moveType: 'I',
          },
        ],
      },
      air,
    );

    expect(next.hitEvents).toHaveLength(1);
    expect(next.players[1].life).toBe(940);
    expect(next.players[1].stateNo).toBe(5000);
    expect(next.players[0].hitDefUsed).toBe(true);
  });

  it('does not hit twice while hitDefUsed is true', () => {
    const state = createInitialGameState();
    const next = resolveFallbackHits(
      {
        ...state,
        players: [
          {
            ...state.players[0],
            x: 240,
            y: 285,
            facing: 1,
            stateNo: 200,
            animNo: 200,
            moveType: 'A',
            hitDefUsed: true,
          },
          {
            ...state.players[1],
            x: 290,
            y: 285,
            facing: -1,
            stateNo: 0,
            animNo: 0,
            moveType: 'I',
          },
        ],
      },
      air,
    );

    expect(next.hitEvents).toHaveLength(0);
    expect(next.players[1].life).toBe(1000);
  });
});
