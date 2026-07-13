import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import type { ExplodCreateRequest } from '../explod/ExplodSystem';
import { applyExplodRuntimeEvents } from './RuntimeExplodIntegration';

describe('RuntimeExplodIntegration compatibility boundary', () => {
  it('applies owner-scoped creation events to production GameState', () => {
    const request = createRequest();
    const result = applyExplodRuntimeEvents(createInitialGameState(), [{ type: 'create', request }]);
    expect(result.explods.entries[0]).toMatchObject({ runtimeId: 1, mugenId: 10, animNo: 9000, position: { x: 105, y: 265 } });
  });
});

function createRequest(): ExplodCreateRequest {
  const owner = { entityId: 1, rootPlayerId: 1 as const };
  return {
    mugenId: 10, owner, animationOwner: owner, animationSource: 'owner', animNo: 9000,
    position: { x: 105, y: 265 }, offset: { x: 5, y: -20 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 },
    facing: 1, verticalFacing: 1, postype: 'p1', coordinateSpace: 'stage', bind: null, removeTime: 30,
    spritePriority: 0, onTop: false, pauseMoveTime: 0, superMoveTime: 0, removeOnGetHit: false, random: { x: 0, y: 0 },
    render: { transparency: null, alpha: null, scaleX: 1, scaleY: 1, ownPalette: false, shadow: { red: 0, green: 0, blue: 0 } },
  };
}
