import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { createInitialGameState } from '../engine/GameState';
import { anyIntersects, getPlayerAttackBoxes, getPlayerBodyBoxes } from './CollisionResolver';

describe('CollisionResolver AIR boxes', () => {
  const airDocument = parseAirText(`
Begin Action 200
Clsn2Default: 1
 Clsn2[0] = -10,-78,10,0
Clsn1Default: 1
 Clsn1[0] = 15,-50,55,-40
200,0, 5,-3, 3
Clsn1: 2
 Clsn1[0] = 1,-10,11,0
 Clsn1[1] = 20,-20,30,-5
200,1, -4,2, 3
200,2, 0,0, 3
[Begin Action 201]
201,0, 7,4, 3
`);

  it('gets attack and body boxes from AIR element', () => {
    const player = {
      ...createInitialGameState().players[0],
      animNo: 200,
      animTime: 0,
      facing: 1 as const,
    };

    expect(getPlayerAttackBoxes(player, airDocument)).toEqual([
      { kind: 'attack', source: 'default', animNo: 200, elementIndex: 0, boxIndex: 0, x: player.x + 20, y: player.y - 53, width: 40, height: 10 },
    ]);

    expect(getPlayerBodyBoxes(player, airDocument)).toEqual([
      { kind: 'body', source: 'default', animNo: 200, elementIndex: 0, boxIndex: 0, x: player.x - 5, y: player.y - 81, width: 20, height: 78 },
    ]);
  });

  it('mirrors boxes when facing left', () => {
    const player = {
      ...createInitialGameState().players[0],
      animNo: 200,
      animTime: 0,
      facing: -1 as const,
    };

    expect(getPlayerAttackBoxes(player, airDocument)).toEqual([
      { kind: 'attack', source: 'default', animNo: 200, elementIndex: 0, boxIndex: 0, x: player.x - 60, y: player.y - 53, width: 40, height: 10 },
    ]);
  });

  it('uses element overrides and preserves multiple-box provenance', () => {
    const player = { ...createInitialGameState().players[0], animNo: 200, animTime: 3, facing: 1 as const };
    expect(getPlayerAttackBoxes(player, airDocument)).toEqual([
      { kind: 'attack', source: 'element', animNo: 200, elementIndex: 1, boxIndex: 0, x: player.x - 3, y: player.y - 8, width: 10, height: 10 },
      { kind: 'attack', source: 'element', animNo: 200, elementIndex: 1, boxIndex: 1, x: player.x + 16, y: player.y - 18, width: 10, height: 15 },
    ]);
  });

  it('does not replace a boxless element with fixed rectangles', () => {
    const player = { ...createInitialGameState().players[0], animNo: 201, animTime: 0 };
    expect(getPlayerAttackBoxes(player, airDocument)).toEqual([]);
    expect(getPlayerBodyBoxes(player, airDocument)).toEqual([]);
  });

  it('detects intersection', () => {
    expect(
      anyIntersects(
        [{ x: 0, y: 0, width: 10, height: 10 }],
        [{ x: 5, y: 5, width: 10, height: 10 }],
      ),
    ).toBe(true);
  });
});
