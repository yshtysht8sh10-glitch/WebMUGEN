import { describe, expect, it } from 'vitest';
import { stepGame } from './Engine';
import type { FrameInput, GameState, PlayerInput, PlayerState } from './types';
import { createInitialExplodRuntimeState } from '../explod/ExplodSystem';

function createPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 1,
    x: 120,
    y: 285,
    vx: 0,
    vy: 0,
    facing: 1,
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
    activeHitDef: null,
    hitDefUsed: false,
    ...overrides,
  };
}

function createState(player: PlayerState): GameState {
  return {
    frame: 0,
    players: [player, createPlayer({ id: 2, x: 420, facing: -1 })],
    projectiles: [],
    hitEvents: [],
    explods: createInitialExplodRuntimeState(),
    helpers: { entries: [], nextEntityId: 3 },
  };
}

function input(overrides: Partial<PlayerInput>): FrameInput {
  return {
    p1: {
      left: false,
      right: false,
      up: false,
      down: false,
      attack: false,
      ...overrides,
    },
  };
}

describe('fallback input ctrl gate', () => {
  it.each([
    ['left', { left: true }],
    ['right', { right: true }],
    ['up', { up: true }],
    ['down', { down: true }],
    ['attack', { attack: true }],
    ['forward dash', { commandNames: new Set(['ff']) }],
    ['back dash', { commandNames: new Set(['bb']) }],
  ] as const)('does not route %s while ctrl is false', (_label, playerInput) => {
    const locked = createPlayer({
      stateNo: 6000,
      animNo: 6000,
      stateTime: 12,
      ctrl: false,
      vx: 0,
      vy: 0,
    });

    const result = stepGame(createState(locked), input(playerInput));

    expect(result.players[0]).toMatchObject({
      stateNo: 6000,
      animNo: 6000,
      ctrl: false,
      vx: 0,
      vy: 0,
      x: 120,
      y: 285,
    });
  });
});
