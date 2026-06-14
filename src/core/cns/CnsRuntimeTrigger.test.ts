import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { evaluateCnsRuntimeTrigger } from './CnsRuntimeTrigger';

describe('CnsRuntimeTrigger', () => {
  const player = {
    ...createInitialGameState().players[0],
    stateTime: 6,
    animTime: 12,
    ctrl: true,
    stateType: 'S' as const,
    moveType: 'I' as const,
  };

  it('evaluates constants', () => {
    expect(evaluateCnsRuntimeTrigger('1', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('0', { player })).toBe(false);
  });

  it('evaluates time comparisons', () => {
    expect(evaluateCnsRuntimeTrigger('time > 5', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('time = 6', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('time <= 5', { player })).toBe(false);
  });

  it('evaluates animtime comparisons', () => {
    expect(evaluateCnsRuntimeTrigger('animtime = 12', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('animtime < 12', { player })).toBe(false);
  });

  it('evaluates ctrl', () => {
    expect(evaluateCnsRuntimeTrigger('ctrl', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('ctrl', { player: { ...player, ctrl: false } })).toBe(false);
  });

  it('evaluates statetype and movetype', () => {
    expect(evaluateCnsRuntimeTrigger('statetype = S', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('statetype != A', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('movetype = I', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('movetype != H', { player })).toBe(true);
  });

  it('evaluates command triggers', () => {
    expect(evaluateCnsRuntimeTrigger('command = "x"', {
      player,
      commands: new Set(['x']),
    })).toBe(true);

    expect(evaluateCnsRuntimeTrigger('command = "y"', {
      player,
      commands: new Set(['x']),
    })).toBe(false);
  });
});
