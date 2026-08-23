import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { applyExplodCreateEvents, synchronizeBoundExplodPositions, type ExplodCreateRequest } from './ExplodSystem';

describe('Explod production runtime model', () => {
  it('allocates internal IDs independently from duplicate MUGEN IDs and preserves snapshots', () => {
    const request = createRequest({ mugenId: 1000 });
    const first = applyExplodCreateEvents(createInitialGameState(), [{ type: 'create', request }, { type: 'create', request }]);
    expect(first.explods.entries.map((entry) => ({ runtimeId: entry.runtimeId, mugenId: entry.mugenId }))).toEqual([
      { runtimeId: 1, mugenId: 1000 }, { runtimeId: 2, mugenId: 1000 },
    ]);
    expect(first.explods.entries[0]).toMatchObject({ age: 0, animTime: 0, creationFrame: 0, removeTime: -2 });
    expect(first.hitDiagnosticLines?.join('\n')).toContain('raw.explod_create owner=p1 internalId=1 mugenId=1000 drawSlot=1');
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

  it('reuses the first free draw slot while keeping runtime IDs monotonic', () => {
    const request = createRequest({ mugenId: 2221, onTop: true });
    const created = applyExplodCreateEvents(createInitialGameState(), [
      { type: 'create', request },
      { type: 'create', request: { ...request, mugenId: 2225 } },
      { type: 'create', request: { ...request, mugenId: 2200 } },
      { type: 'create', request: { ...request, mugenId: 2230 } },
    ]);
    const withoutBlueBar = {
      ...created,
      explods: {
        ...created.explods,
        entries: created.explods.entries.filter((entry) => entry.mugenId !== 2225),
      },
    };
    const recreated = applyExplodCreateEvents(withoutBlueBar, [
      { type: 'create', request: { ...request, mugenId: 2225 } },
    ]);

    expect(recreated.explods.entries.map((entry) => ({
      mugenId: entry.mugenId,
      runtimeId: entry.runtimeId,
      drawSlot: entry.drawSlot,
    }))).toEqual([
      { mugenId: 2221, runtimeId: 1, drawSlot: 1 },
      { mugenId: 2200, runtimeId: 3, drawSlot: 3 },
      { mugenId: 2230, runtimeId: 4, drawSlot: 4 },
      { mugenId: 2225, runtimeId: 5, drawSlot: 2 },
    ]);
    expect(recreated.explods.nextRuntimeId).toBe(6);
  });

  it('synchronizes bound positions after the owner finishes physics and stage correction', () => {
    const initial = createInitialGameState();
    const request = createRequest({
      position: { x: 230, y: 265 },
      offset: { x: 10, y: -20 },
      bind: { targetEntityId: 1, remaining: 1000, offsetX: 10, offsetY: -20 },
    });
    const created = applyExplodCreateEvents(initial, [{ type: 'create', request }]);
    const movedOwner = { ...created.players[0], x: 500, y: 300, facing: -1 as const };
    const synchronized = synchronizeBoundExplodPositions({ ...created, players: [movedOwner, created.players[1]] });

    expect(synchronized.explods.entries[0].position).toEqual({ x: 490, y: 280 });
    expect(synchronized.explods.entries[0].bind?.remaining).toBe(1000);
  });
});

function createRequest(overrides: Partial<ExplodCreateRequest> = {}): ExplodCreateRequest {
  const owner = { entityId: 1, rootPlayerId: 1 as const };
  return {
    mugenId: 0, owner, animationOwner: owner, animationSource: 'owner', animNo: 10,
    position: { x: 220, y: 285 }, offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 },
    facing: 1, verticalFacing: 1, postype: 'p1', coordinateSpace: 'stage', bind: null, removeTime: -2,
    spritePriority: 0, onTop: false, pauseMoveTime: 0, superMoveTime: 0, removeOnGetHit: false, random: { x: 0, y: 0 },
    render: { transparency: null, alpha: null, scaleX: 1, scaleY: 1, ownPalette: false, shadow: { red: 0, green: 0, blue: 0 } },
    ...overrides,
  };
}
