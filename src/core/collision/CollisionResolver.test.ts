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
200,0, 0,0, 3
`);

  it('gets attack and body boxes from AIR element', () => {
    const player = {
      ...createInitialGameState().players[0],
      animNo: 200,
      animTime: 0,
      facing: 1 as const,
    };

    expect(getPlayerAttackBoxes(player, airDocument)).toEqual([
      { kind: 'attack', x: player.x + 15, y: player.y - 50, width: 40, height: 10 },
    ]);

    expect(getPlayerBodyBoxes(player, airDocument)).toEqual([
      { kind: 'body', x: player.x - 10, y: player.y - 78, width: 20, height: 78 },
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
      { kind: 'attack', x: player.x - 55, y: player.y - 50, width: 40, height: 10 },
    ]);
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
