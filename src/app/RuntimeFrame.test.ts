import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../core/engine/GameState';
import { applyExplodCreateEvents, stepExplodRuntime, type ExplodCreateRequest } from '../core/explod/ExplodSystem';
import { synchronizeRuntimeFrame } from './RuntimeFrame';

describe('App runtime frame synchronization regression', () => {
  it('advances GameState.frame so an Explod leaves its creation tick exactly once', () => {
    let state = synchronizeRuntimeFrame(createInitialGameState(), 1);
    state = applyExplodCreateEvents(state, [{ type: 'create', request: createRequest() }]);
    state = stepExplodRuntime(state, () => null);
    expect(state.explods.entries[0]).toMatchObject({ creationFrame: 1, age: 0, animTime: 0 });

    state = synchronizeRuntimeFrame(state, 2);
    state = stepExplodRuntime(state, () => null);
    expect(state.explods.entries[0]).toMatchObject({ creationFrame: 1, age: 1, animTime: 1 });
    expect(state.frame).toBe(2);
  });
});

function createRequest(): ExplodCreateRequest {
  const owner = { entityId: 1, rootPlayerId: 1 as const };
  return {
    mugenId: 43, owner, animationOwner: owner, animationSource: 'owner', animNo: 100,
    position: { x: 220, y: 285 }, offset: { x: 0, y: 0 }, velocity: { x: 1, y: 0 }, acceleration: { x: 0, y: 0 },
    facing: 1, verticalFacing: 1, postype: 'p1', coordinateSpace: 'stage', bind: null, removeTime: 10,
    spritePriority: 0, onTop: false, pauseMoveTime: 0, superMoveTime: 0, removeOnGetHit: false, random: { x: 0, y: 0 },
    render: { transparency: null, alpha: null, scaleX: 1, scaleY: 1, ownPalette: false, shadow: { red: 0, green: 0, blue: 0 } },
  };
}
