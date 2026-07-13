import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../../core/engine/GameState';
import type { ExplodRuntimeEntry } from '../../core/explod/ExplodSystem';
import type { AirDocument } from '../../parser/air/AirTypes';
import type { SpritePack } from '../../core/sprite/SpriteTypes';
import { CanvasRenderer } from './CanvasRenderer';

describe('CanvasRenderer Explod integration', () => {
  it('draws the owner AIR/SFF frame with Explod facing and vfacing exactly once', () => {
    const drawImage = vi.fn();
    const scale = vi.fn();
    const context = fakeContext({ drawImage, scale });
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const state = createInitialGameState();
    state.explods.entries = [entry()];
    const image = {} as HTMLImageElement;
    const ownerTwoAir = air(200, 20, 3);
    const ownerTwoSprites: SpritePack = { sprites: new Map([['20,3', { groupNo: 20, imageNo: 3, src: '', xAxis: 4, yAxis: 5, image }]]) };
    const renderer = new CanvasRenderer(canvas, air(100, 10, 0), null, null, {
      1: { airDocument: air(100, 10, 0) },
      2: { airDocument: ownerTwoAir, spritePack: ownerTwoSprites },
    });

    const diagnostics = renderer.render(state);

    expect(drawImage).toHaveBeenCalledWith(image, -2, -7);
    expect(scale).toHaveBeenCalledWith(-1, -1);
    expect(diagnostics).toContainEqual(expect.stringContaining('raw.explod_draw internalId=9'));
    expect(diagnostics).toContainEqual(expect.stringContaining('result=drawn'));
  });

  it('does not draw a placeholder when the sprite is missing', () => {
    const drawImage = vi.fn();
    const context = fakeContext({ drawImage, scale: vi.fn() });
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const state = createInitialGameState();
    state.explods.entries = [entry()];
    const renderer = new CanvasRenderer(canvas, undefined, null, null, {
      2: { airDocument: air(200, 20, 3), spritePack: { sprites: new Map() } },
    });

    const diagnostics = renderer.render(state);

    expect(drawImage).not.toHaveBeenCalled();
    expect(diagnostics).toContainEqual(expect.stringContaining('result=hidden reason=sprite_not_found'));
  });
});

function fakeContext(spies: { drawImage: ReturnType<typeof vi.fn>; scale: ReturnType<typeof vi.fn> }): CanvasRenderingContext2D {
  return {
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), fillText: vi.fn(), drawImage: spies.drawImage,
    scale: spies.scale,
  } as unknown as CanvasRenderingContext2D;
}

function air(actionNo: number, groupNo: number, imageNo: number): AirDocument {
  return { actions: [{ actionNo, elements: [{ groupNo, imageNo, offsetX: 2, offsetY: -2, duration: 3, clsn1: [], clsn2: [] }], defaultClsn1: [], defaultClsn2: [] }] };
}

function entry(): ExplodRuntimeEntry {
  return {
    runtimeId: 9, mugenId: 90, owner: { entityId: 2, rootPlayerId: 2 }, animationOwner: { entityId: 2, rootPlayerId: 2 },
    animationSource: 'owner', animNo: 200, animTime: 0, animElement: 0, creationFrame: 0, age: 0,
    position: { x: 320, y: 240 }, offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 },
    facing: -1, verticalFacing: -1, postype: 'p2', coordinateSpace: 'stage', bind: null, removeTime: null, removalReason: null,
    spritePriority: 2, onTop: false, pauseMoveTime: 0, superMoveTime: 0, removeOnGetHit: false, random: { x: 0, y: 0 },
    render: { transparency: null, alpha: null, scaleX: 1, scaleY: 1, ownPalette: false, shadow: 0 },
  };
}
