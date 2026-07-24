import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { evaluateCnsRuntimeTrigger } from './CnsRuntimeTrigger';

describe('round, team, and animation Trigger integration', () => {
  const players = createInitialGameState().players;

  it('reads round counters, match identity, and explicit Single team data', () => {
    const context = {
      player: players[0], opponent: players[1], roundNo: 3, roundsExisted: 2, matchNo: 1,
      teamMode: 'single' as const, isHomeTeam: true, numEnemy: 1, numPartner: 0,
    };
    expect(evaluateCnsRuntimeTrigger('RoundNo = 3', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('RoundsExisted = 2', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('MatchNo = 1', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('TeamMode = Single', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IsHomeTeam = 1', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('NumEnemy = 1', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('NumPartner = 0', context)).toBe(true);
  });

  it('distinguishes KO, time, perfect, and loser suffixes symmetrically', () => {
    expect(evaluateCnsRuntimeTrigger('WinKO', {
      player: players[0], opponent: players[1], roundWinner: 1, roundEndReason: 'ko',
    })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('WinPerfect = 1', {
      player: { ...players[0], life: 1000 }, opponent: players[1], roundWinner: 1, roundEndReason: 'ko',
    })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('LoseKO', {
      player: players[1], opponent: players[0], roundWinner: 1, roundEndReason: 'ko',
    })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('WinTime', {
      player: players[0], opponent: players[1], roundWinner: 1, roundEndReason: 'time_over',
    })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('LoseTime = 1', {
      player: players[1], opponent: players[0], roundWinner: 1, roundEndReason: 'time_over',
    })).toBe(true);
  });

  it('distinguishes the documented Simul and Turns enum values without Single fallback', () => {
    const base = { player: players[0], opponent: players[1] };
    expect(evaluateCnsRuntimeTrigger('TeamMode = Simul', { ...base, teamMode: 'simul', numPartner: 1 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('TeamMode = Single', { ...base, teamMode: 'simul', numPartner: 1 })).toBe(false);
    expect(evaluateCnsRuntimeTrigger('TeamMode = Turns', { ...base, teamMode: 'turns', numPartner: 2 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('NumPartner = 2', { ...base, teamMode: 'turns', numPartner: 2 })).toBe(true);
  });

  it('evaluates AnimElemNo at an expression-based AIR time offset', () => {
    const calls: number[] = [];
    const context = {
      player: { ...players[0], vars: { 0: 2 } },
      animElemNoAtOffset: (offset: number) => {
        calls.push(offset);
        return offset === 2 ? 4 : null;
      },
    };
    expect(evaluateCnsRuntimeTrigger('AnimElemNo(Var(0)) = 4', context)).toBe(true);
    expect(calls).toEqual([2]);
  });
});
