import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { applyExplodCreateEvents, type ExplodCreateRequest } from './ExplodSystem';

describe('Explod production runtime model', () => {
  it('allocates internal IDs independently from duplicate MUGEN IDs and preserves snapshots', () => {
    const request = createRequest({ mugenId: 1000 });
    const first = applyExplodCreateEvents(createInitialGameState(), [{ type: 'create', request }, { type: 'create', request }]);
    expect(first.explods.entries.map((entry) => ({ runtimeId: entry.runtimeId, mugenId: entry.mugenId }))).toEqual([
      { runtimeId: 1, mugenId: 1000 }, { runtimeId: 2, mugenId: 1000 },
    ]);
    expect(first.explods.entries[0]).toMatchObject({ age: 0, animTime: 0, creationFrame: 0, removeTime: -2 });
    expect(first.hitDiagnosticLines?.join('\n')).toContain('raw.explod_create owner=p1 internalId=1 mugenId=1000');
  });

  it('keeps owners separate and records rejected animation diagnostics without allocating an ID', () => {
    const p1 = createRequest({ owner: { entityId: 1, rootPlayerId: 1 }, mugenId: 5 });
    const p2Owner = { entityId: 2, rootPlayerId: 2 as const };
    const p2 = createRequest({ owner: p2Owner, animationOwner: p2Owner, mugenId: 5 });
    const result = applyExplodCreateEvents(createInitialGameState(), [
      { type: 'create', request: p1 }, { type: 'create', request: p2 },
      { type: 'rejected', owner: p1.owner, reason: 'missing_anim', rawAnim: '' },
    ]);
    expect(result.explods.entries.map((entry) => entry.owner.rootPlayerId)).toEqual([1, 2]);
    expect(result.explods.nextRuntimeId).toBe(3);
    expect(result.hitDiagnosticLines?.join('\n')).toContain('raw.explod_create_rejected owner=p1 reason=missing_anim');
  });
});

function createRequest(overrides: Partial<ExplodCreateRequest> = {}): ExplodCreateRequest {
  const owner = { entityId: 1, rootPlayerId: 1 as const };
  return {
    mugenId: 0, owner, animationOwner: owner, animationSource: 'owner', animNo: 10,
    position: { x: 220, y: 285 }, offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 },
    facing: 1, verticalFacing: 1, postype: 'p1', coordinateSpace: 'stage', bind: null, removeTime: -2,
    spritePriority: 0, onTop: false, pauseMoveTime: 0, superMoveTime: 0, removeOnGetHit: false, random: { x: 0, y: 0 },
    render: { transparency: null, alpha: null, scaleX: 1, scaleY: 1, ownPalette: false, shadow: 0 },
    ...overrides,
  };
}
