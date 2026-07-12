import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { pruneTargets, registerTarget, removeTarget, selectTargets } from './TargetState';

describe('TargetState', () => {
  it('stores multiple targets and filters by HitDef id', () => {
    const state = createInitialGameState();
    let owner = registerTarget(state.players[0], state.players[1], 10, 42);
    owner = { ...owner, targets: [...(owner.targets ?? []), { playerId: 3, hitDefId: 77, activeHitDefId: 11 }] };
    expect(selectTargets(owner)).toHaveLength(2);
    expect(selectTargets(owner, 42)[0]).toMatchObject({ playerId: 2, hitDefId: 42, activeHitDefId: 10 });
  });

  it('removes destroyed or KO targets', () => {
    const state = createInitialGameState();
    const owner = registerTarget(state.players[0], state.players[1], 10, 42);
    expect(removeTarget(owner, 2).targets).toEqual([]);
    expect(pruneTargets(owner, [{ ...state.players[1], life: 0 }]).targets).toEqual([]);
  });
});
