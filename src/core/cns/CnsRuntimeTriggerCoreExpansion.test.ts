import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { evaluateCnsRuntimeTrigger } from './CnsRuntimeTrigger';

describe('CnsRuntimeTrigger core expansion', () => {
  const player = {
    ...createInitialGameState().players[0],
    stateNo: 200,
    animNo: 200,
    animTime: 5,
    stateTime: 12,
    x: 130,
    y: 360,
    vx: 2.5,
    vy: -1,
    facing: 1 as const,
    stateType: 'S' as const,
    moveType: 'A' as const,
  };

  const opponent = {
    ...createInitialGameState().players[1],
    x: 170,
    y: 360,
    life: 850,
    stateNo: 0,
    facing: -1 as const,
    stateType: 'S' as const,
    moveType: 'I' as const,
  };

  it('evaluates Anim and StateNo comparisons', () => {
    expect(evaluateCnsRuntimeTrigger('Anim = 200', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Anim != 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('StateNo = 200', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('StateNo < 100', { player })).toBe(false);
  });

  it('evaluates Pos and Vel comparisons', () => {
    expect(evaluateCnsRuntimeTrigger('Pos X >= 100', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Pos Y = 75', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Vel X > 2', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Vel Y < 0', { player })).toBe(true);
  });

  it('evaluates Facing', () => {
    expect(evaluateCnsRuntimeTrigger('Facing = 1', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Facing = -1', { player })).toBe(false);
  });

  it('evaluates AnimElem only when the requested AIR element starts', () => {
    const context = {
      player,
      animElemNo: 5,
      animElemTime: 0,
      animElemStarted: true,
      animElemCount: 6,
      animElemTimes: [8, 6, 4, 2, 0, -3],
    };
    expect(evaluateCnsRuntimeTrigger('AnimElem = 5', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimElem = 5', { ...context, animElemStarted: false, animElemTime: 1 })).toBe(false);
    expect(evaluateCnsRuntimeTrigger('AnimElem = 6', context)).toBe(false);
    expect(evaluateCnsRuntimeTrigger('AnimElem = 7', context)).toBe(false);
    expect(evaluateCnsRuntimeTrigger('AnimElem = 5, = 0', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimElem = 5, >= 0', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimElem = 6, < 0', context)).toBe(true);
  });

  it('evaluates AnimelemTime from AIR element-relative times', () => {
    const context = { player, animElemTimes: [8, 6, 4, 2, 0, -3] };
    expect(evaluateCnsRuntimeTrigger('AnimElemTime(5) = 0', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimElemTime(3) > 1', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimElemTime(6) < 0', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimElemTime(7) != 0', context)).toBe(false);
  });

  it('evaluates common global and range triggers', () => {
    expect(evaluateCnsRuntimeTrigger('GameTime >= 100', { player, gameTime: 120 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('TicksPerSecond = 60', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('StateNo = [100, 300]', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('StateNo != [0, 99]', { player })).toBe(true);
  });

  it('returns the elapsed MoveHit value instead of a permanent boolean 1', () => {
    const contacted = {
      ...player,
      moveContact: { activeHitDefId: 7, contact: true, hit: true, guarded: false, elapsed: 1, hitCount: 1 },
    };
    expect(evaluateCnsRuntimeTrigger('MoveHit = 1', { player: contacted })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('MoveHit = 2', {
      player: { ...contacted, moveContact: { ...contacted.moveContact, elapsed: 2 } },
    })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('MoveHit = 1', {
      player: { ...contacted, moveContact: { ...contacted.moveContact, elapsed: 2 } },
    })).toBe(false);
  });

  it('evaluates screen and edge distance triggers', () => {
    expect(evaluateCnsRuntimeTrigger('ScreenPos X = 130', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('BackEdgeDist > 100', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('FrontEdgeDist > 800', { player, screenWidth: 960 })).toBe(true);
  });

  it('evaluates P2 and EnemyNear redirects', () => {
    expect(evaluateCnsRuntimeTrigger('P2Life = 850', { player, opponent })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('P2StateNo = 0', { player, opponent })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('P2BodyDist X = 40', { player, opponent })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('EnemyNear, StateNo = 0', { player, opponent })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('EnemyNear, Pos X = 170', { player, opponent })).toBe(true);
  });

  it('evaluates guard, hit and helper-safe fallback triggers', () => {
    expect(evaluateCnsRuntimeTrigger('InGuardDist', { player, opponent })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('CanRecover', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('NumEnemy > 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('NumHelper = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IsHelper = 0', { player })).toBe(true);
  });

  it('evaluates math-like trigger functions and GetHitVar defaults', () => {
    expect(evaluateCnsRuntimeTrigger('Abs(Vel Y) = 1', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Floor(Vel X) = 2', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Ceil(Vel X) = 3', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('GetHitVar(Fall) = 0', { player })).toBe(true);
  });
});
