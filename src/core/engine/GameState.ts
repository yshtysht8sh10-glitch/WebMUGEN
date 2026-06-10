import type { GameState } from './types';

export function createInitialGameState(): GameState {
  return {
    frame: 0,
    players: [
      {
        x: 220,
        y: 285,
        vx: 0,
        vy: 0,
        facing: 1,
        stateNo: 0,
        stateTime: 0,
        animNo: 0,
        animTime: 0,
      },
    ],
  };
}
