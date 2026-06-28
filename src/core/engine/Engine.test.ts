import { describe, expect, it } from 'vitest';
import { stepGame } from './Engine';
import type { FrameInput, GameState, PlayerInput, PlayerState } from './types';

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

function createState(player: PlayerState = createPlayer()): GameState {
  return {
    frame: 0,
    players: [player, createPlayer({ id: 2, x: 420, facing: -1 })],
    projectiles: [],
    hitEvents: [],
  };
}

function input(overrides: Partial<PlayerInput> = {}): FrameInput {
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

describe('stepGame crouch routing', () => {
  it('enters state 10 when down is pressed from stand', () => {
    const next = stepGame(createState(), input({ down: true }));

    expect(next.players[0].stateNo).toBe(10);
    expect(next.players[0].animNo).toBe(10);
    expect(next.players[0].stateType).toBe('C');
    expect(next.players[0].physics).toBe('C');
  });

  it('holds crouch as state 11 after crouch start', () => {
    const crouchStart = stepGame(createState(), input({ down: true }));
    const crouchHold = stepGame(crouchStart, input({ down: true }));

    expect(crouchHold.players[0].stateNo).toBe(11);
    expect(crouchHold.players[0].animNo).toBe(11);
    expect(crouchHold.players[0].stateType).toBe('C');
    expect(crouchHold.players[0].physics).toBe('C');
  });

  it('enters state 12 when down is released from crouch', () => {
    const crouchStart = stepGame(createState(), input({ down: true }));
    const crouchHold = stepGame(crouchStart, input({ down: true }));
    const crouchEnd = stepGame(crouchHold, input({ down: false }));

    expect(crouchEnd.players[0].stateNo).toBe(12);
    expect(crouchEnd.players[0].animNo).toBe(12);
    expect(crouchEnd.players[0].stateType).toBe('S');
    expect(crouchEnd.players[0].physics).toBe('S');
  });
});
