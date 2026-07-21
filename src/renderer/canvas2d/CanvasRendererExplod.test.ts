import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../../core/engine/GameState';
import type { ExplodRuntimeEntry } from '../../core/explod/ExplodSystem';
import type { AirDocument } from '../../parser/air/AirTypes';
import type { SpritePack } from '../../core/sprite/SpriteTypes';
import { CanvasRenderer } from './CanvasRenderer';
import { createAfterImageState } from '../../core/afterimage/AfterImageSystem';

describe('CanvasRenderer Explod integration', () => {
  it('draws the owner AIR/SFF frame with Explod facing and vfacing exactly once', () => {
    const drawImage = vi.fn();
    const scale = vi.fn();
    const translate = vi.fn();
    const context = fakeContext({ drawImage, scale, translate });
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
    expect(translate).toHaveBeenCalledWith(320, 240);
    expect(scale).toHaveBeenCalledWith(-2, -3);
    expect(diagnostics).toContainEqual(expect.stringContaining('raw.explod_draw internalId=9'));
    expect(diagnostics).toContainEqual(expect.stringContaining('result=drawn'));
  });

  it('does not draw a placeholder when the sprite is missing', () => {
    const drawImage = vi.fn();
    const context = fakeContext({ drawImage, scale: vi.fn(), translate: vi.fn() });
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

  it('uses the AIR element A field when the Explod controller has no trans override', () => {
    const observedBlend: Array<{ composite: GlobalCompositeOperation; alpha: number }> = [];
    let context: CanvasRenderingContext2D;
    const drawImage = vi.fn(() => observedBlend.push({
      composite: context.globalCompositeOperation,
      alpha: context.globalAlpha,
    }));
    context = fakeContext({ drawImage, scale: vi.fn(), translate: vi.fn() });
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const state = createInitialGameState();
    state.explods.entries = [entry()];
    const image = {} as HTMLImageElement;
    const assets = { airDocument: air(200, 20, 3, 'A'), spritePack: { sprites: new Map([['20,3', { groupNo: 20, imageNo: 3, src: '', xAxis: 4, yAxis: 5, image }]]) } as SpritePack };

    const diagnostics = new CanvasRenderer(canvas, undefined, null, null, { 2: assets }).render(state);

    expect(observedBlend).toEqual([{ composite: 'lighter', alpha: 0.5 }]);
    expect(diagnostics).toContainEqual(expect.stringContaining('trans=A alpha=(256,256) composite=lighter'));
    expect(diagnostics).toContainEqual(expect.stringContaining('transSource=air'));
    expect(diagnostics).toContainEqual(expect.stringContaining('limitation=air_a_source_alpha_approximated'));
  });

  it('darkens an active SuperPause before drawing onTop Explods', () => {
    const order: string[] = [];
    let fillStyle = '';
    const drawImage = vi.fn(() => order.push('ontop'));
    const context = {
      ...fakeContext({ drawImage, scale: vi.fn(), translate: vi.fn() }),
      set fillStyle(value: string) { fillStyle = value; },
      get fillStyle() { return fillStyle; },
      fillRect: vi.fn((x: number, y: number, width: number, height: number) => {
        if (fillStyle === 'rgba(0, 0, 0, 0.5)' && x === 0 && y === 0 && width === 640 && height === 360) order.push('darken');
      }),
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const state = createInitialGameState();
    state.pause = { pauseTime: 0, superPauseTime: 40, darken: true, moveTime: 0, ownerEntityId: 1, kind: 'superpause', resumeGuard: false };
    state.explods.entries = [{ ...entry(), onTop: true }];
    const image = {} as HTMLImageElement;
    const assets = { airDocument: air(200, 20, 3), spritePack: { sprites: new Map([['20,3', { groupNo: 20, imageNo: 3, src: '', xAxis: 4, yAxis: 5, image }]]) } as SpritePack };

    const diagnostics = new CanvasRenderer(canvas, undefined, null, null, { 2: assets }).render(state);

    expect(order).toEqual(['darken', 'ontop']);
    expect(diagnostics).toContain('raw.superpause_darken remaining=40 opacity=0.5 layer=before_ontop result=drawn');
  });

  it('does not darken normal Pause or darken=0 SuperPause', () => {
    const fullScreenDarken = vi.fn();
    let fillStyle = '';
    const context = {
      ...fakeContext({ drawImage: vi.fn(), scale: vi.fn(), translate: vi.fn() }),
      set fillStyle(value: string) { fillStyle = value; },
      get fillStyle() { return fillStyle; },
      fillRect: vi.fn((x: number, y: number, width: number, height: number) => {
        if (fillStyle === 'rgba(0, 0, 0, 0.5)' && x === 0 && y === 0 && width === 640 && height === 360) fullScreenDarken();
      }),
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const initial = createInitialGameState();
    const renderer = new CanvasRenderer(canvas);

    const pauseDiagnostics = renderer.render({ ...initial, pause: { pauseTime: 10, superPauseTime: 0, darken: false, moveTime: 0, ownerEntityId: 1, kind: 'pause', resumeGuard: false } });
    const disabledDiagnostics = renderer.render({ ...initial, pause: { pauseTime: 0, superPauseTime: 10, darken: false, moveTime: 0, ownerEntityId: 1, kind: 'superpause', resumeGuard: false } });

    expect(fullScreenDarken).not.toHaveBeenCalled();
    expect([...pauseDiagnostics, ...disabledDiagnostics].some((line) => line.startsWith('raw.superpause_darken'))).toBe(false);
  });

  it('draws retained AfterImage frames behind the player with controller transparency', () => {
    const observed: Array<{ x: number; composite: GlobalCompositeOperation }> = [];
    let context: CanvasRenderingContext2D;
    const translate = vi.fn((x: number) => observed.push({ x, composite: context.globalCompositeOperation }));
    context = fakeContext({ drawImage: vi.fn(), scale: vi.fn(), translate });
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const state = createInitialGameState();
    state.players[0] = {
      ...state.players[0],
      animNo: 100,
      afterImage: {
        ...createAfterImageState(42, { frameGap: 6, transparency: 'add1' }),
        frames: [{ x: 180, y: 285, facing: 1, animNo: 100, animTime: 0, age: 6 }],
      },
    };
    const image = {} as HTMLImageElement;
    const assets = { airDocument: air(100, 10, 0), spritePack: { sprites: new Map([['10,0', { groupNo: 10, imageNo: 0, src: '', xAxis: 4, yAxis: 5, image }]]) } as SpritePack };

    const diagnostics = new CanvasRenderer(canvas, undefined, null, null, { 1: assets }).render(state);

    expect(observed).toContainEqual({ x: 180, composite: 'lighter' });
    expect(observed).toContainEqual({ x: 220, composite: 'source-over' });
    expect(diagnostics).toContainEqual(expect.stringContaining('raw.afterimage_draw entity=p1 captured=1 displayed=1 drawn=1'));
    expect(diagnostics).toContainEqual(expect.stringContaining('trans=add1 composite=lighter'));
  });

  it('applies BGPalFX only while drawing the stage layer', () => {
    const stageFilters: string[] = [];
    let filter = 'none';
    const context = {
      ...fakeContext({ drawImage: vi.fn(), scale: vi.fn(), translate: vi.fn() }),
      set filter(value: string) { filter = value; },
      get filter() { return filter; },
      fillRect: vi.fn((_x: number, y: number) => { if (y === 0) stageFilters.push(filter); }),
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const state = createInitialGameState();
    state.bgPalFx = {
      duration: 20, remainingTime: 19, elapsedTime: 1, color: 0, invertAll: true,
      add: { red: 0, green: 0, blue: 0 }, multiply: { red: 0, green: 0, blue: 0 },
      sinAdd: { red: 0, green: 0, blue: 0, period: 0 }, ownerEntityId: 1,
    };

    const diagnostics = new CanvasRenderer(canvas).render(state);

    expect(stageFilters).toEqual(['grayscale(1) brightness(0) invert(1)']);
    expect(diagnostics).toContainEqual(expect.stringContaining('raw.bgpalfx_draw owner=1 remaining=19'));
  });
});

function fakeContext(spies: { drawImage: ReturnType<typeof vi.fn>; scale: ReturnType<typeof vi.fn>; translate: ReturnType<typeof vi.fn> }): CanvasRenderingContext2D {
  return {
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), fillText: vi.fn(), drawImage: spies.drawImage,
    scale: spies.scale, translate: spies.translate,
  } as unknown as CanvasRenderingContext2D;
}

function air(actionNo: number, groupNo: number, imageNo: number, blend = ''): AirDocument {
  return { actions: [{ actionNo, elements: [{ groupNo, imageNo, offsetX: 2, offsetY: -2, duration: 3, blend, clsn1: [], clsn2: [] }], defaultClsn1: [], defaultClsn2: [] }] };
}

function entry(): ExplodRuntimeEntry {
  return {
    runtimeId: 9, mugenId: 90, owner: { entityId: 2, rootPlayerId: 2 }, animationOwner: { entityId: 2, rootPlayerId: 2 },
    animationSource: 'owner', animNo: 200, animTime: 0, animElement: 0, creationFrame: 0, age: 0, removeTimeElapsed: 0, removeTimeStartFrame: 0,
    position: { x: 320, y: 240 }, offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 },
    facing: -1, verticalFacing: -1, postype: 'p2', coordinateSpace: 'stage', bind: null, removeTime: null, removalReason: null,
    spritePriority: 2, onTop: false, pauseMoveTime: 0, superMoveTime: 0, removeOnGetHit: false, random: { x: 0, y: 0 },
    render: { transparency: null, alpha: null, scaleX: 2, scaleY: 3, ownPalette: false, shadow: { red: 0, green: 0, blue: 0 } },
  };
}
