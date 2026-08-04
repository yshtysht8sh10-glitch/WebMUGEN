import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../core/engine/GameState';
import { createInitialRoundState } from '../core/engine/RoundState';
import { createInitialRoundScore } from '../core/engine/RoundScore';
import { loadWinMugenStage } from './winmugen/WinMugenStageLoader';
import { loadWebMugenStage, parseWebMugenStage } from './webmugen/WebMugenStageLoader';
import { WebMugenStageRuntime } from './webmugen/WebMugenStageRuntime';
import { createWebMugenStagePresentationRenderer } from './webmugen/WebMugenStagePresentationRenderer';
import { FreshClasicStageRenderer } from './webmugen/FreshClasicStageRenderer';
import { WebMugenStageRenderer } from './webmugen/WebMugenStageRenderer';
import { loadWinMugenLifeBar } from '../lifebar/winmugen/WinMugenLifeBarLoader';
import { WinMugenLifeBarRuntime } from '../lifebar/winmugen/WinMugenLifeBarRuntime';
import { loadWebMugenLifeBar, parseWebMugenLifeBar } from '../lifebar/webmugen/WebMugenLifeBarLoader';
import { WebMugenLifeBarRuntime } from '../lifebar/webmugen/WebMugenLifeBarRuntime';

const nativeStage = {
  format: 'webmugen-stage', version: 1, id: 'cyber-training', name: 'Cyber Training', groundY: 0,
  players: { p1Start: [-70, 0], p2Start: [70, 0] },
  camera: { boundLeft: -400, boundRight: 400, boundHigh: -120, boundLow: 0, verticalFollow: 0.2, tension: 50 },
  layers: [{ type: 'image', src: 'background.png', zIndex: -100, fit: 'cover', parallax: 0.03 }],
};
const nativeLifeBar = {
  format: 'webmugen-lifebar', version: 1, id: 'default-cyber', name: 'Cyber HUD', layout: 'responsive',
  show: { life: true, power: true, timer: true, round: true, wins: true },
};

describe('WinMUGEN and WebMUGEN presentation separation', () => {
  it('routes only WebMUGEN JSON through the native stage loader', async () => {
    const definition = await loadWebMugenStage('/stages/webmugen/cyber-training/stage.json', async () => ({ ok: true, status: 200, json: async () => nativeStage }));
    expect(definition).toMatchObject({ format: 'webmugen-stage', id: 'cyber-training' });
    await expect(loadWebMugenStage('/stages/winmugen/stage.def')).rejects.toThrow('WebMUGEN stage loader');
    await expect(loadWinMugenStage('/stages/webmugen/stage.json')).rejects.toThrow('WinMUGEN stage loader');
    expect(() => parseWebMugenStage({ format: 'winmugen-stage', version: 1 })).toThrow('Not a WebMUGEN stage');
  });

  it('accepts Catalog-owned WebMUGEN definitions below the same-origin content root', async () => {
    const stage = await loadWebMugenStage('/content/stages/native/stage.json', async () => ({ ok: true, status: 200, json: async () => nativeStage }));
    const lifeBar = await loadWebMugenLifeBar('/content/lifebars/native/lifebar.json', async () => ({ ok: true, status: 200, json: async () => nativeLifeBar }));
    const winLifeBar = await loadWinMugenLifeBar('/content/lifebars/classic/fight.def', async () => ({ ok: true, status: 200, text: async () => '[Files]\nsff=fight.sff\nair=fight.air' }));
    expect([stage.id, lifeBar.id, winLifeBar.format]).toEqual(['cyber-training', 'default-cyber', 'winmugen-fight-def']);
  });

  it('exposes native stage ground, camera, and bounds through the common runtime', () => {
    const runtime = new WebMugenStageRuntime(parseWebMugenStage(nativeStage));
    expect(runtime.engine).toBe('webmugen');
    expect(runtime.getGroundY()).toBe(0);
    expect(runtime.getBounds()).toEqual({ left: -400, right: 400, high: -120, low: 0 });
    expect(runtime.getCameraConfig()).toMatchObject({ verticalFollow: 0.2, tension: 50 });
  });

  it('uses a safe solid fallback while a native background image is unavailable', () => {
    const runtime = new WebMugenStageRuntime(parseWebMugenStage(nativeStage));
    const fillRect = vi.fn();
    runtime.render({ ctx: { fillRect } as unknown as CanvasRenderingContext2D, viewportWidth: 800, viewportHeight: 480, cameraX: 0, cameraY: 0 });
    expect(fillRect).toHaveBeenCalledWith(0, 0, 800, 480);
  });

  it('keeps Fresh and Cyber on distinct native definitions and image assets', () => {
    const freshPath = resolve('public/stages/webmugen/fresh-training/stage.json');
    const cyberPath = resolve('public/stages/webmugen/cyber-training/stage.json');
    const fresh = parseWebMugenStage(JSON.parse(readFileSync(freshPath, 'utf8')), '/stages/webmugen/fresh-training/stage.json');
    const cyber = parseWebMugenStage(JSON.parse(readFileSync(cyberPath, 'utf8')), '/stages/webmugen/cyber-training/stage.json');
    expect(fresh.id).toBe('fresh-training');
    expect(cyber.id).toBe('cyber-training');
    expect(fresh.layers[0].src).toBe('/stages/webmugen/fresh-training/background.png');
    expect(cyber.layers[0].src).toBe('/stages/webmugen/cyber-training/background.png');
    expect(fresh.layers[0].src).not.toBe(cyber.layers[0].src);
  });

  it('keeps Fresh Clasic procedural and loads Cyber Clasic as a four-layer image stage', () => {
    const fresh = parseWebMugenStage(JSON.parse(readFileSync(resolve('public/stages/webmugen/fresh-clasic/stage.json'), 'utf8')));
    const cyber = parseWebMugenStage(JSON.parse(readFileSync(resolve('public/stages/webmugen/cyber-clasic/stage.json'), 'utf8')), '/stages/webmugen/cyber-clasic/stage.json');
    expect(fresh).toMatchObject({ id: 'fresh-clasic', name: 'Fresh Clasic', presentation: 'fresh-clasic', layers: [] });
    expect(cyber).toMatchObject({ id: 'cyber-clasic', name: 'Cyber Clasic', presentation: 'image' });
    expect(cyber.layers).toHaveLength(4);
    expect(cyber.layers.map((layer) => [layer.id, layer.pass, layer.cameraFactor])).toEqual([
      ['sky', 'background', [0.03, 0.02]],
      ['distant-structures', 'background', [0.08, 0.03]],
      ['perspective-floor', 'background', [0.22, 0.1]],
      ['near-glow', 'foreground', [0.38, 0.14]],
    ]);
    expect(createWebMugenStagePresentationRenderer(fresh.presentation)).toBeInstanceOf(FreshClasicStageRenderer);
    expect(createWebMugenStagePresentationRenderer(cyber.presentation)).toBeInstanceOf(WebMugenStageRenderer);
    for (const layer of cyber.layers) expect(statSync(resolve(`public${layer.src}`)).size).toBeGreaterThan(0);
  });

  it('renders Fresh Clasic procedurally while Cyber Clasic owns a separate foreground pass', () => {
    const gradient = () => ({ addColorStop: vi.fn() });
    const context = {
      arc: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(), fill: vi.fn(), fillRect: vi.fn(),
      lineTo: vi.fn(), moveTo: vi.fn(), restore: vi.fn(), save: vi.fn(), stroke: vi.fn(),
      createLinearGradient: vi.fn(gradient), createRadialGradient: vi.fn(gradient),
      fillStyle: '', strokeStyle: '', lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;
    const renderContext = { ctx: context, viewportWidth: 800, viewportHeight: 480, cameraX: 0, cameraY: 0 };
    const fresh = parseWebMugenStage(JSON.parse(readFileSync(resolve('public/stages/webmugen/fresh-clasic/stage.json'), 'utf8')));
    const cyber = parseWebMugenStage(JSON.parse(readFileSync(resolve('public/stages/webmugen/cyber-clasic/stage.json'), 'utf8')), '/stages/webmugen/cyber-clasic/stage.json');

    new WebMugenStageRuntime(fresh).render(renderContext);
    const cyberRuntime = new WebMugenStageRuntime(cyber);
    cyberRuntime.render(renderContext);
    cyberRuntime.renderForeground(renderContext);

    expect(context.fillRect).toHaveBeenCalled();
    expect(context.createLinearGradient).toHaveBeenCalled();
    expect(context.createRadialGradient).toHaveBeenCalled();
  });

  it('normalizes legacy image layers to background and validates optional foreground camera factors', () => {
    const legacy = parseWebMugenStage(nativeStage);
    expect(legacy.layers[0]).toMatchObject({ id: 'layer-0', pass: 'background', cameraFactor: [0.03, 0], parallax: 0.03, parallaxY: 0 });
    const layered = parseWebMugenStage({
      ...nativeStage,
      layers: [{ type: 'image', id: 'front', src: 'front.png', pass: 'foreground', parallax: 0.4, parallaxY: 0.15 }],
    });
    expect(layered.layers[0]).toMatchObject({ id: 'front', pass: 'foreground', parallax: 0.4, parallaxY: 0.15 });
    expect(parseWebMugenStage({
      ...nativeStage,
      layers: [{ type: 'image', src: 'factor.png', cameraFactor: [0.7, 0.25] }],
    }).layers[0].cameraFactor).toEqual([0.7, 0.25]);
  });

  it('keeps WinMUGEN fight.def and WebMUGEN lifebar JSON in distinct loaders', async () => {
    const win = await loadWinMugenLifeBar('/lifebars/winmugen/fight.def', async () => ({ ok: true, status: 200, text: async () => '[Info]\nname=Classic\n[Files]\nsff=fight.sff\nfightfx.air=fightfx.air' }));
    const native = await loadWebMugenLifeBar('/lifebars/webmugen/default/lifebar.json', async () => ({ ok: true, status: 200, json: async () => nativeLifeBar }));
    expect(win.format).toBe('winmugen-fight-def');
    expect(native.format).toBe('webmugen-lifebar');
    await expect(loadWinMugenLifeBar('/lifebars/webmugen/lifebar.json')).rejects.toThrow('WinMUGEN lifebar loader');
    expect(() => parseWebMugenLifeBar({ format: 'winmugen-fight-def', version: 1 })).toThrow('Not a WebMUGEN');
  });

  it('can switch lifebar engines independently of the game and stage state', () => {
    const web = new WebMugenLifeBarRuntime(parseWebMugenLifeBar(nativeLifeBar));
    const win = new WinMugenLifeBarRuntime({ format: 'winmugen-fight-def', id: 'classic', name: 'Classic', defPath: '/lifebars/winmugen/fight.def' });
    const state = createInitialGameState();
    web.update(state, createInitialRoundState(), createInitialRoundScore());
    win.update(state, createInitialRoundState(), createInitialRoundScore());
    expect([web.engine, win.engine]).toEqual(['webmugen', 'winmugen']);
    expect([web.id, win.id]).toEqual(['default-cyber', 'classic']);
  });
});
