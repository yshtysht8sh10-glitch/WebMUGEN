import type { GameState, PlayerState } from './types';

export function createInitialGameState(): GameState {
  return {
    frame: 0,
    players: [createPlayer(1, 220, 285, 1), createPlayer(2, 420, 285, -1)],
    hitEvents: [],
  };
}

function createPlayer(id: 1 | 2, x: number, y: number, facing: 1 | -1): PlayerState {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    facing,
    life: 1000,
    stateNo: 0,
    stateTime: 0,
    stateType: 'S',
    moveType: 'I',
    physics: 'S',
    ctrl: true,
    animNo: 0,
    animTime: 0,
    hitPause: 0,
  };
}
