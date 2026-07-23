import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { evaluateCnsRuntimeTrigger } from './CnsRuntimeTrigger';

describe('entity and projectile Trigger integration', () => {
  const state = createInitialGameState();

  it('resolves Root, Parent, Helper and PlayerID through the runtime entity resolver', () => {
    const helper = { ...state.players[0], stateNo: 200 };
    const root = { ...state.players[0], stateNo: 0 };
    const parent = { ...state.players[0], stateNo: 100 };
    const child = { ...state.players[0], stateNo: 300 };
    const resolveRedirectEntity = (kind: 'root' | 'parent' | 'helper' | 'playerid' | 'partner', argument?: number) => {
      if (kind === 'root') return root;
      if (kind === 'parent') return parent;
      if (kind === 'helper' && argument === 100) return child;
      if (kind === 'playerid' && argument === 3) return helper;
      return undefined;
    };
    const context = {
      player: helper,
      entityId: 3,
      isHelper: true,
      resolveRedirectEntity,
      playerIdExists: (id: number) => [1, 2, 3].includes(id),
    };

    expect(evaluateCnsRuntimeTrigger('ID = 3', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('PlayerIDExist(3) = 1', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('PlayerIDExist(99) = 0', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Root, StateNo = 0', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Parent, StateNo = 100', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Helper(100), StateNo = 300', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('PlayerID(3), StateNo = 200', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Partner, StateNo = 0', context)).toBe(false);
  });

  it('counts live projectiles and evaluates hit, contact, and guarded histories', () => {
    const contacts = {
      1000: { contactTime: 4, hitTime: 4, guardedTime: -1 },
      2000: { contactTime: 1, hitTime: -1, guardedTime: 1 },
    };
    const elapsed = (id: number, field: keyof (typeof contacts)[1000]) => {
      if (id > 0) return contacts[id as keyof typeof contacts]?.[field] ?? -1;
      const values = Object.values(contacts).map((entry) => entry[field]).filter((value) => value >= 0);
      return values.length ? Math.min(...values) : -1;
    };
    const context = {
      player: state.players[0],
      numProj: (id?: number) => id === undefined ? 2 : id === 1000 ? 1 : 0,
      projContactTime: (id: number) => elapsed(id, 'contactTime'),
      projHitTime: (id: number) => elapsed(id, 'hitTime'),
      projGuardedTime: (id: number) => elapsed(id, 'guardedTime'),
    };

    expect(evaluateCnsRuntimeTrigger('NumProj = 2', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('NumProjID(1000) = 1', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('ProjContact2000 = 1', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('ProjGuarded2000 = 1', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('ProjHit1000 = 1, >= 4', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('ProjContact = 1', context)).toBe(true);
  });
});
