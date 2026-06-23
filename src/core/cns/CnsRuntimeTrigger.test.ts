import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { evaluateCnsRuntimeTrigger, evaluateCnsRuntimeTriggerGroup } from './CnsRuntimeTrigger';

describe('CnsRuntimeTrigger', () => {
  const player = {
    ...createInitialGameState().players[0],
    stateTime: 6,
    animTime: 12,
    ctrl: true,
    stateType: 'S' as const,
    moveType: 'I' as const,
  };

  it('evaluates animtime using MUGEN-like value when supplied', () => {
    expect(evaluateCnsRuntimeTrigger('AnimTime = 0', { player, animTime: 0 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimTime > 0', { player, animTime: 4 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimTime = 12', { player })).toBe(true);
  });

  it('evaluates command equality and inequality', () => {
    expect(evaluateCnsRuntimeTrigger('command = "QCF_x"', {
      player,
      commands: new Set(['qcf_x']),
    })).toBe(true);

    expect(evaluateCnsRuntimeTrigger('command != "holddown"', {
      player,
      commands: new Set(['x']),
    })).toBe(true);

    expect(evaluateCnsRuntimeTrigger('command != "holddown"', {
      player,
      commands: new Set(['holddown']),
    })).toBe(false);
  });

  it('evaluates trigger groups as OR of AND groups', () => {
    expect(evaluateCnsRuntimeTriggerGroup([
      'trigger1: ctrl',
      'trigger1: command = "x"',
    ], {
      player,
      commands: new Set(['x']),
    })).toBe(true);

    expect(evaluateCnsRuntimeTriggerGroup([
      'trigger1: ctrl',
      'trigger1: command = "x"',
    ], {
      player,
      commands: new Set(),
    })).toBe(false);

    expect(evaluateCnsRuntimeTriggerGroup([
      'trigger1: ctrl',
      'trigger1: command = "x"',
      'trigger2: time > 5',
    ], {
      player,
      commands: new Set(),
    })).toBe(true);
  });

  it('requires triggerall before any trigger group may pass', () => {
    expect(evaluateCnsRuntimeTriggerGroup([
      'triggerall: command = "QCF_x"',
      'trigger1: statetype = S',
      'trigger1: ctrl',
    ], {
      player,
      commands: new Set(['qcf_x']),
    })).toBe(true);

    expect(evaluateCnsRuntimeTriggerGroup([
      'triggerall: command = "QCF_x"',
      'trigger1: statetype = S',
      'trigger1: ctrl',
    ], {
      player,
      commands: new Set(['x']),
    })).toBe(false);
  });
});
