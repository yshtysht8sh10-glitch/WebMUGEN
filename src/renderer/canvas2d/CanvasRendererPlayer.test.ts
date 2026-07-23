import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../../core/engine/GameState';
import type { AirDocument } from '../../parser/air/AirTypes';
import type { SpritePack } from '../../core/sprite/SpriteTypes';
import { CanvasRenderer } from './CanvasRenderer';

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
      keyCtrl: false, ownPal: false, spawnFrame: 0,
      player: { ...state.players[0], x: 300, animNo: 1000 },
    }];

    const diagnostics = renderer.render(state).join('\n');

    expect(drawImage).toHaveBeenCalledTimes(3);
    expect(diagnostics.match(/spriteExists=1 result=drawn/g)).toHaveLength(3);
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

  it('resolves ChangeAnim2 frames from the recorded animation owner', () => {
    const drawImage = vi.fn();
    const context = fakeContext(vi.fn(), vi.fn(), drawImage);
    const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
    const p1Assets = { airDocument: air(0, 10, 0), spritePack: spritePack(10, 0) };
    const p2Assets = { airDocument: air(900, 20, 0), spritePack: spritePack(20, 0) };
    const renderer = new CanvasRenderer(canvas, undefined, null, null, { 1: p1Assets, 2: p2Assets });
    const state = createInitialGameState();
    state.players[0] = { ...state.players[0], animNo: 900, stateOwnerId: 2, animationOwnerId: 2 };

    const diagnostics = renderer.render(state).join('\n');

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(diagnostics).toContain('entity=p1 state=0 anim=900 stateOwner=2 animOwner=2');
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
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
    fillRect, strokeRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), ellipse, fill: vi.fn(),
    fillText: vi.fn(), drawImage, strokeStyle: '', fillStyle: '', font: '',
  } as unknown as CanvasRenderingContext2D;
}

function spritePack(groupNo: number, imageNo: number): SpritePack {
  return {
    sprites: new Map([[`${groupNo},${imageNo}`, {
      groupNo,
      imageNo,
      src: 'test.png',
      xAxis: 0,
      yAxis: 0,
      image: {} as HTMLImageElement,
    }]]),
  };
}

function air(actionNo: number, groupNo: number, imageNo: number): AirDocument {
  return {
    actions: [{
      actionNo,
      elements: [{ groupNo, imageNo, offsetX: 0, offsetY: 0, duration: 3, clsn1: [], clsn2: [] }],
      defaultClsn1: [],
      defaultClsn2: [],
    }],
  };
}
