import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { createInitialGameState } from '../engine/GameState';
import { createSpriteDebugInfo } from './SpriteDebugInfo';
import type { ImageDataSpritePack } from './ImageDataSpriteTypes';

describe('SpriteDebugInfo', () => {
  it('reports current AIR sprite key and whether ImageData sprite exists', () => {
    const state = createInitialGameState();
    const air = parseAirText(`
Begin Action 0
200,2, 0,0, 5
`);
    const pack: ImageDataSpritePack = {
      sprites: new Map([
        [
          '200,2',
          {
            groupNo: 200,
            imageNo: 2,
            xAxis: 16,
            yAxis: 78,
            imageData: {
              width: 1,
              height: 1,
              data: new Uint8ClampedArray(4),
              colorSpace: 'srgb',
            } as ImageData,
          },
        ],
      ]),
    };

    const debugInfo = createSpriteDebugInfo(state.players, air, pack, null);

    expect(debugInfo.imageDataSpriteCount).toBe(1);
    expect(debugInfo.players[0]).toMatchObject({
      playerId: 1,
      animNo: 0,
      groupNo: 200,
      imageNo: 2,
      key: '200,2',
      hasImageDataSprite: true,
    });
  });

  it('reports missing sprite', () => {
    const state = createInitialGameState();
    const air = parseAirText(`
Begin Action 0
0,0, 0,0, 5
`);

    const debugInfo = createSpriteDebugInfo(state.players, air, { sprites: new Map() }, null);

    expect(debugInfo.players[0].key).toBe('0,0');
    expect(debugInfo.players[0].hasImageDataSprite).toBe(false);
  });
});
