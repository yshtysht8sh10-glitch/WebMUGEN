import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../../core/engine/GameState';
import { createInitialRoundState } from '../../core/engine/RoundState';
import type { AirDocument } from '../../parser/air/AirTypes';
import type { SpritePack } from '../../core/sprite/SpriteTypes';
import { CanvasRenderer } from './CanvasRenderer';
import type { StageRuntime } from '../../stage/StageRuntime';

describe('CanvasRenderer player sprite fallback', () => {
  it('skips every debug rectangle path while keeping normal sprite rendering enabled', () => {
    const fillText = vi.fn();
    const drawImage = vi.fn();
    const context = {
      ...fakeContext(vi.fn(), vi.fn(), drawImage),
      fillText,
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(0, 10, 0), spritePack: spritePack(10, 0) };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets });

    const diagnostics = renderer.render(createInitialGameState(), undefined, undefined, undefined, {
      collisionBoxesVisible: false,
      diagnosticsEnabled: false,
    });

    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(fillText.mock.calls.some(([text]) => String(text).startsWith('push '))).toBe(false);
    expect(diagnostics).toEqual([]);
  });

  it('draws the FIGHT presentation after both player sprites', () => {
    const order: string[] = [];
    const drawImage = vi.fn(() => order.push('player'));
    const context = {
      ...fakeContext(vi.fn(), vi.fn(), drawImage),
      fillText: vi.fn((text: string) => { if (text === 'FIGHT!') order.push(text); }),
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 800, height: 480, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(0, 10, 0), spritePack: spritePack(10, 0) };
    const round = { ...createInitialRoundState(), introPresentationFrame: 45 };

    new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets })
      .render(createInitialGameState(), undefined, round, undefined, { collisionBoxesVisible: false });

    expect(order).toEqual(['player', 'player', 'FIGHT!']);
  });

  it('renders the AIR frame presented before the motion clock advances', () => {
    const context = fakeContext(vi.fn(), vi.fn(), vi.fn());
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const airDocument: AirDocument = {
      actions: [{
        actionNo: 730,
        elements: [
          { groupNo: 730, imageNo: 10, offsetX: 0, offsetY: 0, duration: 30, clsn1: [], clsn2: [] },
          { groupNo: 5030, imageNo: 506, offsetX: 0, offsetY: 0, duration: 2, clsn1: [], clsn2: [] },
        ],
        defaultClsn1: [], defaultClsn2: [],
      }],
    };
    const assets = {
      airDocument,
      spritePack: {
        sprites: new Map([
          ...spritePack(730, 10).sprites,
          ...spritePack(5030, 506).sprites,
        ]),
      } as SpritePack,
    };
    const state = createInitialGameState();
    state.players[0] = {
      ...state.players[0], stateNo: 730, stateTime: 30, animNo: 730, animTime: 30,
      presentedAnimation: { stateNo: 730, stateTime: 29, animNo: 730, animTime: 29 },
    };
    state.players[1] = { ...state.players[1], assertSpecialFlags: ['invisible'] };

    const diagnostics = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets })
      .render(state, undefined, undefined, undefined, { collisionBoxesVisible: false }).join('\n');

    expect(diagnostics).toContain('airElementSpriteGroup=730 airElementSpriteIndex=10');
    expect(diagnostics).not.toContain('airElementSpriteGroup=5030 airElementSpriteIndex=506');
  });

  it('applies AngleDraw transforms to both root and Helper sprites and reports evaluated values', () => {
    const context = fakeContext(vi.fn(), vi.fn(), vi.fn());
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(0, 10, 0), spritePack: spritePack(10, 0) };
    const state = createInitialGameState();
    state.players[1] = { ...state.players[1], drawAngle: 10, drawScale: { x: 0.75, y: 0.75 } };
    state.helpers.entries = [{
      entityId: 3, helperId: 3725, rootEntityId: 1, parentEntityId: 1,
      ownerCharacterId: 1, stateOwnerId: 1, animationOwnerId: 1,
      keyCtrl: false, ownPal: false, spawnFrame: -1,
      player: { ...state.players[0], drawAngle: 10, drawScale: { x: 1.25, y: 1.25 } },
    }];

    const diagnostics = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets })
      .render(state).join('\n');

    expect(context.scale).toHaveBeenCalledWith(0.75, 0.75);
    expect(context.scale).toHaveBeenCalledWith(1.25, 1.25);
    expect(context.rotate).toHaveBeenCalledWith(-10 * Math.PI / 180);
    expect(context.rotate).toHaveBeenCalledWith(10 * Math.PI / 180);
    expect(diagnostics).toContain('drawScale=(0.75,0.75)');
    expect(diagnostics).toContain('drawAngle=10 drawScale=(1.25,1.25)');
  });

  it('applies an AIR V flag to a Helper sprite before its AngleDraw transform', () => {
    const scale = vi.fn();
    const context = { ...fakeContext(vi.fn(), vi.fn(), vi.fn()), scale };
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const airDocument: AirDocument = {
      actions: [{
        actionNo: 1370,
        elements: [{
          groupNo: 1362, imageNo: 0, offsetX: 0, offsetY: 0, duration: 3,
          flip: 'V', clsn1: [], clsn2: [],
        }],
        defaultClsn1: [], defaultClsn2: [],
      }],
    };
    const assets = { airDocument, spritePack: spritePack(1362, 0) };
    const state = createInitialGameState();
    state.players = [
      { ...state.players[0], assertSpecialFlags: ['invisible'] },
      { ...state.players[1], assertSpecialFlags: ['invisible'] },
    ];
    state.helpers.entries = [{
      entityId: 3, helperId: 1310, rootEntityId: 1, parentEntityId: 1,
      ownerCharacterId: 1, stateOwnerId: 1, animationOwnerId: 1,
      keyCtrl: false, ownPal: false, spawnFrame: -1, hasCompletedInitialStatePass: true,
      player: {
        ...state.players[0], stateNo: 1310, animNo: 1370,
        assertSpecialFlags: [], drawAngle: 20, drawScale: { x: 1, y: 0.7 },
      },
    }];

    new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets }).render(state);

    expect(scale).toHaveBeenCalledWith(1, 0.7);
    expect(scale).toHaveBeenCalledWith(1, -1);
  });

  it('keeps an AIR offset outside AngleDraw rotation and rotates around the offset sprite axis', () => {
    const translate = vi.fn();
    const rotate = vi.fn();
    const scale = vi.fn();
    const drawImage = vi.fn();
    const context = { ...fakeContext(vi.fn(), vi.fn(), drawImage), translate, rotate, scale };
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(106, 105, 5, 2, -16), spritePack: spritePack(105, 5, 39, 59) };
    const state = createInitialGameState();
    state.players[0] = {
      ...state.players[0], animNo: 106, drawAngle: 90, drawScale: { x: 0.75, y: 0.5 },
    };
    state.players[1] = { ...state.players[1], assertSpecialFlags: ['invisible'] };

    new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets }).render(state);

    const angleScaleOrder = scale.mock.invocationCallOrder[scale.mock.calls.findIndex(([x, y]) => x === 0.75 && y === 0.5)];
    const offsetOrder = translate.mock.invocationCallOrder[translate.mock.calls.findIndex(([x, y]) => x === 1.5 && y === -8)];
    const rotationOrder = rotate.mock.invocationCallOrder[0];
    expect(offsetOrder).toBeLessThan(rotationOrder);
    expect(rotationOrder).toBeLessThan(angleScaleOrder);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), -39, -59);
  });

  it('draws a stage foreground after players and before the HUD presentation', () => {
    const order: string[] = [];
    const drawImage = vi.fn(() => order.push('player'));
    const context = {
      ...fakeContext(vi.fn(), vi.fn(), drawImage),
      fillText: vi.fn((value: string) => { if (value === 'FIGHT!') order.push('hud'); }),
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 800, height: 480, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(0, 10, 0), spritePack: spritePack(10, 0) };
    const stageRuntime: StageRuntime = {
      engine: 'webmugen', id: 'layer-order', update: vi.fn(),
      render: () => order.push('background'),
      renderForeground: () => order.push('foreground'),
      getBounds: () => ({ left: -400, right: 400, high: -120, low: 0 }),
      getCameraConfig: () => ({ left: -400, right: 400, high: -120, low: 0, verticalFollow: 0.2, tension: 50 }),
      getGroundY: () => 0, isAutoTurnEnabled: () => true, dispose: vi.fn(),
    };
    const round = { ...createInitialRoundState(), introPresentationFrame: 45 };

    new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets }, undefined, undefined, { stageRuntime })
      .render(createInitialGameState(), undefined, round, undefined, { collisionBoxesVisible: false });

    expect(order).toEqual(['background', 'player', 'player', 'foreground', 'hud']);
  });

  it('draws Push and AIR collision labels when collision boxes are enabled', () => {
    const fillText = vi.fn();
    const context = {
      ...fakeContext(vi.fn(), vi.fn()),
      fillText,
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const renderer = new CanvasRenderer(canvas, air(0, 10, 0));

    renderer.render(createInitialGameState(), undefined, undefined, undefined, { collisionBoxesVisible: true });

    expect(fillText.mock.calls.some(([text]) => String(text).startsWith('push '))).toBe(true);
  });

  it('renders a 320x240 WinMUGEN coordinate view into a 640x480 Hi-Res canvas at 2x', () => {
    const drawImage = vi.fn();
    const context = fakeContext(vi.fn(), vi.fn(), drawImage);
    const canvas = { width: 640, height: 480, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(0, 10, 0), spritePack: spritePack(10, 0) };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets });
    const state = createInitialGameState(undefined, {}, [380, 580]);

    renderer.render(state, undefined, undefined, undefined, { collisionBoxesVisible: false });

    expect(context.scale).toHaveBeenCalledWith(2, 2);
    expect(context.translate).toHaveBeenCalledWith(-320, -65);
    expect(context.imageSmoothingEnabled).toBe(false);
    expect(drawImage).toHaveBeenCalledTimes(2);
  });

  it('uses the retained vertical camera position while rendering airborne players', () => {
    const context = fakeContext(vi.fn(), vi.fn(), vi.fn());
    const canvas = { width: 800, height: 480, getContext: () => context } as unknown as HTMLCanvasElement;
    const state = createInitialGameState(undefined, {}, [380, 580]);
    state.camera = { x: 280, y: 53, viewportWidth: 400, viewportHeight: 240 };

    new CanvasRenderer(canvas).render(state, undefined, undefined, undefined, { collisionBoxesVisible: false });

    expect(context.translate).toHaveBeenCalledWith(-280, -53);
  });

  it('applies root Size xscale/yscale inside the 2x WinMUGEN Hi-Res transform', () => {
    const drawImage = vi.fn();
    const context = fakeContext(vi.fn(), vi.fn(), drawImage);
    const canvas = { width: 640, height: 480, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(0, 10, 0), spritePack: spritePack(10, 0) };
    const state = createInitialGameState(undefined, {}, [380, 580]);
    state.players[0] = {
      ...state.players[0],
      collisionWidth: { groundFront: 15, groundBack: 15, airFront: 12, airBack: 12, xScale: 0.5, yScale: 0.5 },
    };

    new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets }).render(state, undefined, undefined, undefined, { collisionBoxesVisible: false });

    expect(context.scale).toHaveBeenCalledWith(2, 2);
    expect(context.scale).toHaveBeenCalledWith(0.5, 0.5);
    expect(drawImage).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when AIR intentionally references a missing SFF sprite', () => {
    const fillRect = vi.fn();
    const ellipse = vi.fn();
    const context = fakeContext(fillRect, ellipse);
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const missingSprites: SpritePack = { sprites: new Map() };
    const assets = { airDocument: air(0, 9999, 0), spritePack: missingSprites };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets });

    const diagnostics = renderer.render(createInitialGameState()).join('\n');

    expect(fillRect).not.toHaveBeenCalledWith(-16, -58, 32, 58);
    expect(ellipse).not.toHaveBeenCalledWith(expect.any(Number), 305, 32, 8, 0, 0, Math.PI * 2);
    expect(diagnostics).toContain('result=skip reason=sprite_missing');
    expect(diagnostics).toContain('airElementSpriteGroup=9999 airElementSpriteIndex=0');
  });

  it('skips a missing AIR action without falling back to Anim 0', () => {
    const fillRect = vi.fn();
    const drawImage = vi.fn();
    const context = fakeContext(fillRect, vi.fn(), drawImage);
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(0, 10, 0), spritePack: spritePack(10, 0) };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets });
    const state = createInitialGameState();
    state.players[0] = { ...state.players[0], animNo: 9999 };

    const diagnostics = renderer.render(state).join('\n');

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(fillRect).not.toHaveBeenCalledWith(-16, -58, 32, 58);
    expect(diagnostics).toContain('entity=p1 state=0 anim=9999');
    expect(diagnostics).toContain('result=skip reason=air_action_missing animExists=0');
  });

  it('treats a negative AIR sprite reference as intentional invisibility', () => {
    const drawImage = vi.fn();
    const context = fakeContext(vi.fn(), vi.fn(), drawImage);
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(0, -1, -1), spritePack: spritePack(10, 0) };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets });

    const diagnostics = renderer.render(createInitialGameState()).join('\n');

    expect(drawImage).not.toHaveBeenCalled();
    expect(diagnostics).toContain('reason=intentional_invisible_element');
  });

  it('skips AssertSpecial invisible players', () => {
    const drawImage = vi.fn();
    const context = fakeContext(vi.fn(), vi.fn(), drawImage);
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(0, 10, 0), spritePack: spritePack(10, 0) };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets });
    const state = createInitialGameState();
    state.players[0] = { ...state.players[0], runtime: { assertSpecial: ['invisible'] } } as typeof state.players[0];

    const diagnostics = renderer.render(state).join('\n');

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(diagnostics).toContain('entity=p1');
    expect(diagnostics).toContain('reason=entity_invisible');
  });

  it('resumes normal drawing after a missing animation becomes valid', () => {
    const drawImage = vi.fn();
    const context = fakeContext(vi.fn(), vi.fn(), drawImage);
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(0, 10, 0), spritePack: spritePack(10, 0) };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets });
    const state = createInitialGameState();
    state.players[0] = { ...state.players[0], animNo: 9999 };
    renderer.render(state);
    drawImage.mockClear();
    state.players[0] = { ...state.players[0], animNo: 0 };

    const diagnostics = renderer.render(state).join('\n');

    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(diagnostics).toContain('entity=p1 state=0 anim=0');
    expect(diagnostics).toContain('spriteExists=1 result=drawn');
  });

  it('never borrows another player owner sprite pack', () => {
    const drawImage = vi.fn();
    const context = fakeContext(vi.fn(), vi.fn(), drawImage);
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const renderer = new CanvasRenderer(canvas, air(0, 10, 0), spritePack(10, 0), null, {
      1: { airDocument: air(0, 10, 0), spritePack: { sprites: new Map() } },
      2: { airDocument: air(0, 20, 0), spritePack: spritePack(20, 0) },
    });

    const diagnostics = renderer.render(createInitialGameState()).join('\n');

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(diagnostics).toContain('entity=p1');
    expect(diagnostics).toContain('airElementSpriteGroup=10');
    expect(diagnostics).toContain('reason=sprite_missing');
    expect(diagnostics).toContain('entity=p2');
    expect(diagnostics).toContain('airElementSpriteGroup=20');
    expect(diagnostics).toContain('spriteExists=1 result=drawn');
  });

  it('keeps the debug fallback when no SFF asset was loaded at all', () => {
    const fillRect = vi.fn();
    const context = fakeContext(fillRect, vi.fn());
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const renderer = new CanvasRenderer(canvas, air(0, 9999, 0));

    renderer.render(createInitialGameState());

    expect(fillRect).toHaveBeenCalledWith(-16, -58, 32, 58);
  });

  it('renders Helpers through their owner character AIR/SFF scope', () => {
    const drawImage = vi.fn();
    const context = fakeContext(vi.fn(), vi.fn(), drawImage);
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(1000, 10, 0), spritePack: spritePack(10, 0) };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets });
    const state = createInitialGameState();
    state.players = [{ ...state.players[0], animNo: 1000 }, { ...state.players[1], animNo: 1000 }];
    state.helpers.entries = [{
      entityId: 3, helperId: 100, rootEntityId: 1, parentEntityId: 1,
      ownerCharacterId: 1, stateOwnerId: 1, animationOwnerId: 1,
      keyCtrl: false, ownPal: false, pauseMoveTime: 0, superMoveTime: 0, spawnFrame: 0,
      player: { ...state.players[0], x: 300, animNo: 1000, collisionWidth: { groundFront: 15, groundBack: 15, airFront: 12, airBack: 12, xScale: 0.5, yScale: 0.75 } },
    }];

    const diagnostics = renderer.render(state).join('\n');

    expect(drawImage).toHaveBeenCalledTimes(3);
    expect(diagnostics.match(/spriteExists=1 result=drawn/g)).toHaveLength(3);
    expect(context.scale).toHaveBeenCalledWith(0.5, 0.75);
    expect(diagnostics).toContain('scale=(0.5,0.75)');
  });

  it('does not draw a newly spawned Helper before its initial State pass', () => {
    const drawImage = vi.fn();
    const context = fakeContext(vi.fn(), vi.fn(), drawImage);
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(1000, 10, 0), spritePack: spritePack(10, 0) };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets });
    const state = createInitialGameState();
    state.players = [{ ...state.players[0], animNo: 1000 }, { ...state.players[1], animNo: 1000 }];
    state.helpers.entries = [{
      entityId: 3, helperId: 100, rootEntityId: 1, parentEntityId: 1,
      ownerCharacterId: 1, stateOwnerId: 1, animationOwnerId: 1,
      keyCtrl: false, ownPal: false, spawnFrame: 0, hasCompletedInitialStatePass: false,
      player: { ...state.players[0], animNo: 1000 },
    }];

    renderer.render(state);
    expect(drawImage).toHaveBeenCalledTimes(2);

    state.helpers.entries[0] = { ...state.helpers.entries[0], hasCompletedInitialStatePass: true };
    renderer.render(state);
    expect(drawImage).toHaveBeenCalledTimes(5);
  });

  it('draws a newly spawned Helper when its StateDef presentation is already stable', () => {
    const drawImage = vi.fn();
    const context = fakeContext(vi.fn(), vi.fn(), drawImage);
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const assets = { airDocument: air(1000, 10, 0), spritePack: spritePack(10, 0) };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: assets, 2: assets });
    const state = createInitialGameState();
    state.players = [{ ...state.players[0], animNo: 1000 }, { ...state.players[1], animNo: 1000 }];
    state.helpers.entries = [{
      entityId: 3, helperId: 100, rootEntityId: 1, parentEntityId: 1,
      ownerCharacterId: 1, stateOwnerId: 1, animationOwnerId: 1,
      keyCtrl: false, ownPal: false, spawnFrame: 0,
      hasCompletedInitialStatePass: false, canRenderBeforeInitialStatePass: true,
      player: { ...state.players[0], animNo: 1000 },
    }];

    renderer.render(state);
    expect(drawImage).toHaveBeenCalledTimes(3);
  });

  it('renders the timed EnvColor layer and reports its ordering', () => {
    const fillRect = vi.fn();
    const context = fakeContext(fillRect, vi.fn());
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const renderer = new CanvasRenderer(canvas);
    const state = createInitialGameState();
    state.envColor = { color: { red: 12, green: 34, blue: 56 }, remainingTime: 5, under: true, ownerEntityId: 1 };

    const diagnostics = renderer.render(state).join('\n');

    expect(fillRect).toHaveBeenCalledWith(0, 0, 640, 360);
    expect(diagnostics).toContain('raw.envcolor_draw owner=1 remaining=5 color=(12,34,56) under=1 result=drawn');
  });

  it('resolves ChangeAnim2 AIR from the state owner and sprite images from the player self owner', () => {
    const drawImage = vi.fn();
    const context = fakeContext(vi.fn(), vi.fn(), drawImage);
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const p1Assets = { airDocument: air(0, 10, 0), spritePack: spritePack(20, 0) };
    const p2Assets = { airDocument: air(900, 20, 0), spritePack: spritePack(999, 0) };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: p1Assets, 2: p2Assets });
    const state = createInitialGameState();
    state.players[0] = {
      ...state.players[0], animNo: 900, stateOwnerId: 2, selfStateOwnerId: 1, animationOwnerId: 2,
    };

    const diagnostics = renderer.render(state).join('\n');

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(diagnostics).toContain('entity=p1 state=0 anim=900 stateOwner=2 animOwner=2 spriteOwner=1');
    expect(diagnostics).toContain('airElementSpriteGroup=20');
  });

  it('suppresses stage and HUD for AssertSpecial noBG/nobardisplay', () => {
    const context = fakeContext(vi.fn(), vi.fn());
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const renderer = new CanvasRenderer(canvas);
    const state = createInitialGameState();
    state.players[0] = { ...state.players[0], assertSpecialFlags: ['noBG', 'nobardisplay'] };

    const diagnostics = renderer.render(state).join('\n');

    expect(diagnostics).toContain('flag=noBG target=stage result=hidden');
    expect(diagnostics).toContain('flag=nobardisplay target=hud result=hidden');
  });
});

function fakeContext(
  fillRect: ReturnType<typeof vi.fn>,
  ellipse: ReturnType<typeof vi.fn>,
  drawImage: ReturnType<typeof vi.fn> = vi.fn(),
): CanvasRenderingContext2D {
  return {
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
    fillRect, strokeRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), ellipse, fill: vi.fn(),
    fillText: vi.fn(), drawImage, strokeStyle: '', fillStyle: '', font: '',
  } as unknown as CanvasRenderingContext2D;
}

function spritePack(groupNo: number, imageNo: number, xAxis = 0, yAxis = 0): SpritePack {
  return {
    sprites: new Map([[`${groupNo},${imageNo}` as `${number},${number}`, {
      groupNo,
      imageNo,
      src: 'test.png',
      xAxis,
      yAxis,
      image: {} as HTMLImageElement,
    }]]),
  };
}

function air(actionNo: number, groupNo: number, imageNo: number, offsetX = 0, offsetY = 0): AirDocument {
  return {
    actions: [{
      actionNo,
      elements: [{ groupNo, imageNo, offsetX, offsetY, duration: 3, clsn1: [], clsn2: [] }],
      defaultClsn1: [],
      defaultClsn2: [],
    }],
  };
}
