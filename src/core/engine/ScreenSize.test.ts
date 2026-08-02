import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { applyViewportCameraRules, getScreenSizeProfile, resolveCanvasViewport, resolveViewportCamera } from './ScreenSize';

describe('screen size profiles', () => {
  it('keeps 2x Hi-Res scaling while offering extended and classic horizontal viewports', () => {
    expect(getScreenSizeProfile('winmugen-800x480')).toEqual({
      width: 800, height: 480, logicalWidth: 400, logicalHeight: 240, renderScale: 2,
    });
    expect(getScreenSizeProfile('winmugen-classic-640x480')).toEqual({
      width: 640, height: 480, logicalWidth: 320, logicalHeight: 240, renderScale: 2,
    });
    expect(getScreenSizeProfile('wide-960x540')).toEqual({
      width: 960, height: 540, logicalWidth: 960, logicalHeight: 540, renderScale: 1,
    });
    expect(resolveCanvasViewport(800, 480)).toEqual({ logicalWidth: 400, logicalHeight: 240, renderScale: 2 });
    expect(resolveCanvasViewport(640, 480)).toEqual({ logicalWidth: 320, logicalHeight: 240, renderScale: 2 });
    expect(resolveCanvasViewport(960, 540)).toEqual({ logicalWidth: 960, logicalHeight: 540, renderScale: 1 });
  });

  it('centers the WinMUGEN camera on both players while wide mode keeps the existing world view', () => {
    const state = createInitialGameState(undefined, {}, [380, 580]);
    expect(resolveViewportCamera(state, 400, 240)).toEqual({ x: 280, y: 65 });
    expect(resolveViewportCamera(state, 320, 240)).toEqual({ x: 320, y: 65 });
    expect(resolveViewportCamera(state, 960, 540)).toEqual({ x: 0, y: 0 });
  });

  it('leaves 100 logical pixels from each axis to the extended viewport edge at round start', () => {
    const state = createInitialGameState(undefined, {}, [380, 580]);
    const camera = resolveViewportCamera(state, 400, 240);
    expect(state.players.map((player) => player.x - camera.x)).toEqual([100, 300]);
  });

  it('keeps both character push boxes inside the camera when their stage separation exceeds the viewport', () => {
    const state = createInitialGameState(undefined, {}, [48, 912]);
    const next = applyViewportCameraRules(state, 400, 240);
    const camera = resolveViewportCamera(next, 400, 240);
    const diagnostics = next.hitDiagnosticLines ?? [];

    expect(next.players[0].x).toBe(299);
    expect(next.players[1].x).toBe(661);
    expect(camera.x).toBe(280);
    expect(next.players[0].x - 15 - camera.x).toBeGreaterThanOrEqual(4);
    expect(next.players[1].x + 15 - camera.x).toBeLessThanOrEqual(396);
    expect(diagnostics[diagnostics.length - 1]).toContain('clamped=p1,p2');
  });

  it('follows an airborne player vertically while retaining the grounded player near the floor', () => {
    const state = createInitialGameState(undefined, {}, [380, 580]);
    state.players = [
      { ...state.players[0], y: 145, stateType: 'A', physics: 'A' },
      state.players[1],
    ];

    const next = applyViewportCameraRules(state, 400, 240);
    expect(resolveViewportCamera(next, 400, 240).y).toBe(53);
    expect(next.players[0].y - 53).toBe(92);
    expect(next.players[1].y - 53).toBe(232);
  });

  it('does not clamp a player whose ScreenBound value is disabled', () => {
    const state = createInitialGameState(undefined, {}, [48, 912]);
    state.players[0] = {
      ...state.players[0],
      screenBound: { value: false, moveCameraX: false, moveCameraY: false },
    };

    const next = applyViewportCameraRules(state, 400, 240);
    expect(next.players[0].x).toBe(48);
    expect(next.players[0].vx).toBe(0);
  });
});
