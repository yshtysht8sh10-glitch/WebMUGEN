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

  it('evaluates Anim and StateNo comparisons', () => {
    expect(evaluateCnsRuntimeTrigger('Anim = 200', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Anim != 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('StateNo = 200', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('StateNo < 100', { player })).toBe(false);
  });

  it('evaluates Pos and Vel comparisons', () => {
    expect(evaluateCnsRuntimeTrigger('Pos X >= 100', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Pos Y = 360', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Vel X > 2', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Vel Y < 0', { player })).toBe(true);
  });

  it('evaluates Facing', () => {
    expect(evaluateCnsRuntimeTrigger('Facing = 1', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Facing = -1', { player })).toBe(false);
  });

  it('evaluates simple Animelem approximation', () => {
    expect(evaluateCnsRuntimeTrigger('AnimElem = 5', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimElem = 6', { player })).toBe(false);
  });

  it('evaluates AnimelemTime approximation', () => {
    expect(evaluateCnsRuntimeTrigger('AnimElemTime(5) = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimElemTime(3) > 1', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimElemTime(7) < 0', { player })).toBe(true);
  });
});
