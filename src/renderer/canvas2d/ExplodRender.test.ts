import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../core/engine/GameState';
import type { ExplodRuntimeEntry } from '../../core/explod/ExplodSystem';
import type { AirDocument } from '../../parser/air/AirTypes';
import { completeExtendedViewportExplodTiles, getExplodsInDrawOrder, resolveExplodRenderFrames } from './ExplodRender';

describe('Explod render resolution', () => {
  it('selects AIR by owner and converts stage-space coordinates through the camera once', () => {
    const state = createInitialGameState();
    state.explods.entries = [
      entry({ runtimeId: 1, owner: { entityId: 1, rootPlayerId: 1 }, animNo: 100, position: { x: 250, y: 280 } }),
      entry({ runtimeId: 2, owner: { entityId: 2, rootPlayerId: 2 }, animNo: 200, position: { x: 40, y: 50 }, coordinateSpace: 'screen', facing: -1 }),
    ];

    const result = resolveExplodRenderFrames(state, {}, {
      1: { airDocument: air(100, 10, 0) },
      2: { airDocument: air(200, 20, 0) },
    }, undefined, 30, 20);

    expect(result.frames.map((frame) => ({
      owner: frame.entry.owner.rootPlayerId,
      group: frame.currentElement.element.groupNo,
      screen: [frame.screenX, frame.screenY],
      facing: frame.entry.facing,
    }))).toEqual([
      { owner: 1, group: 10, screen: [220, 260], facing: 1 },
      { owner: 2, group: 20, screen: [40, 50], facing: -1 },
    ]);
  });

  it('hides missing owner and fightfx animations with diagnostics', () => {
    const state = createInitialGameState();
    state.explods.entries = [entry({ runtimeId: 7, animNo: 999 }), entry({ runtimeId: 8, animationSource: 'fightfx', animationOwner: null })];

    const result = resolveExplodRenderFrames(state, { airDocument: air(100, 10, 0) });

    expect(result.frames).toEqual([]);
    expect(result.diagnosticLines).toEqual([
      expect.stringContaining('internalId=7 mugenId=50 anim=999 result=hidden reason=animation_not_found'),
      expect.stringContaining('internalId=8 mugenId=50 anim=F100 result=hidden reason=animation_not_found'),
    ]);
  });

  it('orders regular priority first and ontop last without changing runtime IDs', () => {
    const state = createInitialGameState();
    state.explods.entries = [
      entry({ runtimeId: 3, spritePriority: 5 }),
      entry({ runtimeId: 2, spritePriority: -2 }),
      entry({ runtimeId: 1, spritePriority: -10, onTop: true }),
    ];
    const frames = resolveExplodRenderFrames(state, { airDocument: air(100, 10, 0) }).frames;

    expect(getExplodsInDrawOrder(frames).map((frame) => frame.entry.runtimeId)).toEqual([2, 3, 1]);
  });

  it('draws newer Explods first so the earlier-created Explod stays in front when sprpriority ties', () => {
    const state = createInitialGameState();
    state.explods.entries = [
      entry({ runtimeId: 1, spritePriority: 7 }),
      entry({ runtimeId: 2, spritePriority: 7 }),
    ];
    const frames = resolveExplodRenderFrames(state, { airDocument: air(100, 10, 0) }).frames;

    expect(getExplodsInDrawOrder(frames).map((frame) => frame.entry.runtimeId)).toEqual([2, 1]);
  });

  it('draws ontop Explods in creation order without applying sprpriority', () => {
    const state = createInitialGameState();
    state.explods.entries = [
      entry({ runtimeId: 1, spritePriority: 7, onTop: true }),
      entry({ runtimeId: 2, spritePriority: 8, onTop: true }),
      entry({ runtimeId: 3, spritePriority: 5, onTop: true }),
      entry({ runtimeId: 4, spritePriority: 9, onTop: true }),
    ];
    const frames = resolveExplodRenderFrames(state, { airDocument: air(100, 10, 0) }).frames;

    expect(getExplodsInDrawOrder(frames).map((frame) => frame.entry.runtimeId)).toEqual([1, 2, 3, 4]);
  });

  it('restores a recreated ontop Explod to its reused allocation slot', () => {
    const state = createInitialGameState();
    state.explods.entries = [
      entry({ runtimeId: 1, drawSlot: 1, onTop: true }),
      entry({ runtimeId: 3, drawSlot: 3, onTop: true }),
      entry({ runtimeId: 4, drawSlot: 4, onTop: true }),
      entry({ runtimeId: 5, drawSlot: 2, onTop: true }),
    ];
    const frames = resolveExplodRenderFrames(state, { airDocument: air(100, 10, 0) }).frames;

    expect(getExplodsInDrawOrder(frames).map((frame) => frame.entry.runtimeId)).toEqual([1, 5, 3, 4]);
  });

  it('extends an authored three-sprite WinMUGEN tile across only the wider viewport', () => {
    const state = createInitialGameState();
    state.explods.entries = [-799, -351, 97].map((x, index) => entry({ runtimeId: index + 1, position: { x, y: 100 } }));
    const imageData = { width: 448, height: 95, data: new Uint8ClampedArray(448 * 95 * 4) } as ImageData;
    const assets = {
      airDocument: air(100, 10, 0),
      imageDataSpritePack: {
        sprites: new Map([['10,0' as const, { groupNo: 10, imageNo: 0, xAxis: 223, yAxis: 45, imageData }]]),
      },
    };
    const authored = resolveExplodRenderFrames(state, assets).frames;

    expect(completeExtendedViewportExplodTiles(authored, 320)).toHaveLength(3);
    const extended = completeExtendedViewportExplodTiles(authored, 400);
    expect(extended.map((frame) => frame.screenX).sort((a, b) => a - b)).toEqual([-799, -351, 97, 545]);
    expect(extended.filter((frame) => frame.supplementalTile)).toHaveLength(1);
  });

  it('does not replicate ordinary or unevenly-spaced Explods', () => {
    const state = createInitialGameState();
    state.explods.entries = [-300, 0, 500].map((x, index) => entry({ runtimeId: index + 1, position: { x, y: 100 } }));
    const frames = resolveExplodRenderFrames(state, { airDocument: air(100, 10, 0) }).frames;

    expect(completeExtendedViewportExplodTiles(frames, 400)).toHaveLength(3);
  });
});

function air(actionNo: number, groupNo: number, imageNo: number): AirDocument {
  return { actions: [{ actionNo, elements: [{ groupNo, imageNo, offsetX: 0, offsetY: 0, duration: 2, clsn1: [], clsn2: [] }], defaultClsn1: [], defaultClsn2: [] }] };
}

function entry(overrides: Partial<ExplodRuntimeEntry> = {}): ExplodRuntimeEntry {
  return {
    runtimeId: 1,
    mugenId: 50,
    owner: { entityId: 1, rootPlayerId: 1 },
    animationOwner: { entityId: 1, rootPlayerId: 1 },
    animationSource: 'owner',
    animNo: 100,
    animTime: 0,
    animElement: 0,
    creationFrame: 0,
    age: 0,
    removeTimeElapsed: 0,
    removeTimeStartFrame: 0,
    position: { x: 100, y: 200 },
    offset: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    facing: 1,
    verticalFacing: 1,
    postype: 'p1',
    coordinateSpace: 'stage',
    bind: null,
    removeTime: null,
    removalReason: null,
    spritePriority: 0,
    onTop: false,
    pauseMoveTime: 0,
    superMoveTime: 0,
    removeOnGetHit: false,
    random: { x: 0, y: 0 },
    render: { transparency: null, alpha: null, scaleX: 1, scaleY: 1, ownPalette: false, shadow: { red: 0, green: 0, blue: 0 } },
    ...overrides,
  };
}
