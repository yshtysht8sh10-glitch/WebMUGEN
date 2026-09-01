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

  it('removes absent targets but retains an acquired target after KO', () => {
    const state = createInitialGameState();
    const owner = registerTarget(state.players[0], state.players[1], 10, 42);
    expect(removeTarget(owner, 2).targets).toEqual([]);
    expect(pruneTargets(owner, [{ ...state.players[1], life: 0 }]).targets).toEqual(owner.targets);
    expect(pruneTargets(owner, [])).toEqual({ ...owner, targets: [] });
  });

  it('does not acquire a new target that was already KO', () => {
    const state = createInitialGameState();
    expect(registerTarget(state.players[0], { ...state.players[1], life: 0 }, 10, 42).targets).toEqual([]);
  });

  it('records whether the acquired target came from a throw HitDef', () => {
    const state = createInitialGameState();
    const owner = registerTarget(state.players[0], state.players[1], 10, 700, true);
    expect(owner.targets).toEqual([
      { playerId: 2, hitDefId: 700, activeHitDefId: 10, throwHit: true },
    ]);
  });
});
