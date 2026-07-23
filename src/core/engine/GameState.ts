import type { GameState, PlayerState } from './types';
import { createInitialExplodRuntimeState } from '../explod/ExplodSystem';
import { createInitialPauseState } from '../pause/PauseSystem';
import { DEFAULT_MAX_POWER } from '../power/PowerGauge';

export function createInitialGameState(powerMax: number = DEFAULT_MAX_POWER): GameState {
  return {
    frame: 0,
    players: [createPlayer(1, 220, 285, 1, powerMax), createPlayer(2, 420, 285, -1, powerMax)],
    projectiles: [],
    hitEvents: [],
    explods: createInitialExplodRuntimeState(),
    helpers: { entries: [], nextEntityId: 3 },
    pause: createInitialPauseState(),
  };
}

function createPlayer(id: 1 | 2, x: number, y: number, facing: 1 | -1, powerMax: number): PlayerState {
  return {
    id,
    palNo: 1,
    vars: {},
    fvars: {},
    sysVars: {},
    sysFVars: {},
    x,
    y,
    vx: 0,
    vy: 0,
    facing,
    life: 1000,
    power: 0,
    powerMax,
    stateNo: 0,
    stateTime: 0,
    stateType: 'S',
    moveType: 'I',
    physics: 'S',
    ctrl: true,
    animNo: 0,
    animTime: 0,
    hitPause: 0,
    activeHitDef: null,
    hitDefUsed: false,
    targets: [],
    stateOwnerId: id,
    selfStateOwnerId: id,
  };
}
