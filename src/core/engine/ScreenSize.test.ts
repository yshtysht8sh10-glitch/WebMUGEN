import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { applyViewportCameraRules, getScreenSizeProfile, resolveCanvasViewport, resolveViewportCamera } from './ScreenSize';
import type { MugenStage } from '../stage/MugenStage';
import { spawnHelper } from '../helper/HelperSystem';

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

  it('keeps both character axes inside the camera when their stage separation exceeds the viewport', () => {
    const state = createInitialGameState(undefined, {}, [48, 912]);
    const next = applyViewportCameraRules(state, 400, 240);
    const camera = resolveViewportCamera(next, 400, 240);
    const diagnostics = next.hitDiagnosticLines ?? [];

    expect(next.players[0].x).toBe(284);
    expect(next.players[1].x).toBe(676);
    expect(camera.x).toBe(280);
    expect(next.players[0].x - camera.x).toBeGreaterThanOrEqual(4);
    expect(next.players[1].x - camera.x).toBeLessThanOrEqual(396);
    expect(diagnostics[diagnostics.length - 1]).toContain('clamped=p1,p2');
  });

  it.each([
    { label: 'P1 retreats left', mover: 0 as const, velocity: -2.4, stationary: 1 as const },
    { label: 'P2 retreats right', mover: 1 as const, velocity: 2.4, stationary: 0 as const },
  ])('keeps the stationary opponent world X fixed when $label on a built-in stage', ({ mover, velocity, stationary }) => {
    const initial = createInitialGameState(undefined, {}, [380, 580]);
    initial.players[mover] = { ...initial.players[mover], stateNo: 21, animNo: 21, vx: velocity };
    let state = applyViewportCameraRules(initial, 400, 240);
    const stationaryX = state.players[stationary].x;

    for (let frame = 0; frame < 120; frame += 1) {
      state = {
        ...state,
        players: state.players.map((player, index) => index === mover
          ? { ...player, x: player.x + velocity, vx: velocity }
          : player) as typeof state.players,
      };
      state = applyViewportCameraRules(state, 400, 240);
      expect(state.players[stationary].x).toBe(stationaryX);
    }

    expect(state.players[mover].vx).toBe(velocity);
    expect(state.players[mover]).toMatchObject({ stateNo: 21, animNo: 21 });
    expect(state.players[stationary].vx).toBe(0);
    expect(state.hitDiagnosticLines?.at(-1)).toContain(`clamped=p${state.players[mover].id}`);
  });

  it.each([
    { label: 'P1 retreats left', mover: 0 as const, velocity: -2.4, stationary: 1 as const },
    { label: 'P2 retreats right', mover: 1 as const, velocity: 2.4, stationary: 0 as const },
  ])('keeps the stationary opponent world X fixed when $label on an external stage', ({ mover, velocity, stationary }) => {
    const stage = beachStage();
    const initial = createInitialGameState(undefined, {}, [380, 580]);
    initial.players[mover] = { ...initial.players[mover], stateNo: 21, animNo: 21, vx: velocity };
    let state = applyViewportCameraRules(initial, 400, 240, stage);
    const stationaryX = state.players[stationary].x;

    for (let frame = 0; frame < 120; frame += 1) {
      state = {
        ...state,
        players: state.players.map((player, index) => index === mover
          ? { ...player, x: player.x + velocity, vx: velocity }
          : player) as typeof state.players,
      };
      state = applyViewportCameraRules(state, 400, 240, stage);
      expect(state.players[stationary].x).toBe(stationaryX);
    }

    expect(state.players[mover].vx).toBe(velocity);
    expect(state.players[mover]).toMatchObject({ stateNo: 21, animNo: 21 });
    expect(state.players[stationary].vx).toBe(0);
    expect(state.hitDiagnosticLines?.at(-1)).toContain(`clamped=p${state.players[mover].id}`);
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

  it('honors a native Stage vertical-follow lock during a jump', () => {
    const state = createInitialGameState(undefined, {}, [380, 580]);
    state.players = [
      { ...state.players[0], y: 145, stateType: 'A', physics: 'A' },
      state.players[1],
    ];

    const next = applyViewportCameraRules(state, 400, 240, undefined, { left: -400, right: 400, verticalFollow: 0 });
    expect(resolveViewportCamera(next, 400, 240).y).toBe(65);
    expect(next.players[1].y - 65).toBe(220);
  });

  it('honors a native single-screen Stage horizontal camera lock', () => {
    const state = createInitialGameState(undefined, {}, [240, 580]);
    const camera = { left: 0, right: 0, verticalFollow: 0 };

    const next = applyViewportCameraRules(state, 400, 240, undefined, camera);
    expect(resolveViewportCamera(next, 400, 240).x).toBe(280);
  });

  it('keeps the native viewport edge aligned with the fallback arena during a wall carry', () => {
    const camera = { left: -400, right: 400, verticalFollow: 0 };
    let state = createInitialGameState(undefined, {}, [876, 856]);
    state.camera = { x: 512, y: 65, viewportWidth: 400, viewportHeight: 240 };
    state.players[1] = {
      ...state.players[1],
      screenBound: { value: false, moveCameraX: false, moveCameraY: false },
    };

    state = applyViewportCameraRules(state, 400, 240, undefined, camera);
    expect(resolveViewportCamera(state, 400, 240).x).toBe(512);
    expect(resolveViewportCamera(state, 400, 240).x + 400).toBe(912);

    state = {
      ...state,
      players: [state.players[0], { ...state.players[1], x: 956 }],
    };
    state = applyViewportCameraRules(state, 400, 240, undefined, camera);
    expect(resolveViewportCamera(state, 400, 240).x).toBe(512);

    state = {
      ...state,
      players: [state.players[0], {
        ...state.players[1],
        x: 912,
        screenBound: { value: true, moveCameraX: true, moveCameraY: true },
      }],
    };
    state = applyViewportCameraRules(state, 400, 240, undefined, camera);
    expect(resolveViewportCamera(state, 400, 240).x).toBe(512);
  });

  it('does not clamp a player whose ScreenBound value is disabled', () => {
    const state = createInitialGameState(undefined, {}, [48, 912]);
    state.players[0] = {
      ...state.players[0],
      screenEdge: 'left',
      screenBound: { value: false, moveCameraX: false, moveCameraY: false },
    };

    const next = applyViewportCameraRules(state, 400, 240);
    expect(next.players[0].x).toBe(48);
    expect(next.players[0].screenEdge).toBeUndefined();
    expect(next.players[0].vx).toBe(0);
  });

  it('uses native Stage tension to follow a wall-carried player until the Stage camera bound', () => {
    const camera = { left: -400, right: 400, verticalFollow: 0, tension: 50 };
    let state = createInitialGameState(undefined, {}, [300, 636]);
    state.camera = { x: 263, y: 65, viewportWidth: 400, viewportHeight: 240 };

    state = applyViewportCameraRules(state, 400, 240, undefined, camera);

    expect(resolveViewportCamera(state, 400, 240).x).toBe(286);
    expect(state.players[0].x).toBe(300);
    expect(state.players[1].x).toBe(636);

    state = {
      ...state,
      players: [state.players[0], { ...state.players[1], x: 900 }],
    };
    state = applyViewportCameraRules(state, 400, 240, undefined, camera);
    expect(resolveViewportCamera(state, 400, 240).x).toBe(286);
    expect(state.players[0].x).toBe(300);
    expect(state.players[1].x).toBe(682);
  });

  it('lets a normal Helper move the camera only after its own ScreenBound opts in', () => {
    const initial = createInitialGameState(undefined, {}, [380, 580]);
    const spawned = spawnHelper(initial.helpers, {
      helperId: 3725, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 3725, x: 900, y: 100,
      facing: 1, keyCtrl: false, ownPal: false, spawnFrame: -1, parent: initial.players[0],
    });
    expect(spawned.entries[0].player.screenBound).toEqual({ value: false, moveCameraX: false, moveCameraY: false });

    const withoutOptIn = applyViewportCameraRules({ ...initial, helpers: spawned }, 400, 240);
    expect(resolveViewportCamera(withoutOptIn, 400, 240)).toEqual({ x: 280, y: 65 });

    const optedIn = {
      ...spawned,
      entries: spawned.entries.map((entry) => ({
        ...entry,
        player: { ...entry.player, screenBound: { value: false, moveCameraX: true, moveCameraY: true } },
      })),
    };
    const followed = applyViewportCameraRules({ ...initial, helpers: optedIn }, 400, 240);
    expect(resolveViewportCamera(followed, 400, 240).x).toBeGreaterThan(280);
    expect(resolveViewportCamera(followed, 400, 240).y).toBeLessThan(65);
  });

  it('retains the previous camera when every entity disables movecamera', () => {
    const state = createInitialGameState(undefined, {}, [700, 900]);
    state.camera = { x: 280, y: 65, viewportWidth: 400, viewportHeight: 240 };
    state.players = state.players.map((player) => ({
      ...player,
      y: 85,
      screenBound: { value: false, moveCameraX: false, moveCameraY: false },
    })) as typeof state.players;

    const native = applyViewportCameraRules(state, 400, 240, undefined, { left: -400, right: 400, verticalFollow: 1 });
    expect(resolveViewportCamera(native, 400, 240)).toEqual({ x: 280, y: 65 });

    const external = applyViewportCameraRules(state, 400, 240, beachStage());
    expect(resolveViewportCamera(external, 400, 240)).toEqual({ x: 280, y: 65 });
  });

  it('keeps a dynamic Width edge bar inside the native viewport', () => {
    const camera = { left: -400, right: 400, verticalFollow: 0 };
    const state = createInitialGameState(undefined, {}, [876, 956]);
    state.camera = { x: 512, y: 65, viewportWidth: 400, viewportHeight: 240 };
    state.players[0] = {
      ...state.players[0],
      widthOverride: {
        edge: { front: 70, back: 0 },
        player: { front: 0, back: 0 },
      },
    };
    state.players[1] = {
      ...state.players[1],
      screenBound: { value: false, moveCameraX: false, moveCameraY: false },
    };

    const next = applyViewportCameraRules(state, 400, 240, undefined, camera);
    expect(resolveViewportCamera(next, 400, 240).x).toBe(512);
    expect(next.players[0].x).toBe(838);
    expect(next.players[0].x + 70).toBe(908);
  });

  it('maps an external Stage camera origin to the extended viewport center', () => {
    const state = createInitialGameState(undefined, {}, [380, 580]);
    const next = applyViewportCameraRules(state, 400, 240, beachStage());

    expect(resolveViewportCamera(next, 400, 240)).toEqual({ x: 280, y: 65 });
  });

  it('uses Stage tension, viewport-adjusted horizontal bounds, and vertical follow', () => {
    const state = createInitialGameState(undefined, {}, [380, 700]);
    state.players[0] = { ...state.players[0], y: 125, stateType: 'A', physics: 'A' };
    const next = applyViewportCameraRules(state, 400, 240, beachStage());

    expect(resolveViewportCamera(next, 400, 240)).toEqual({ x: 350, y: 11 });

    const beyond = createInitialGameState(undefined, {}, [380, 1000]);
    const bounded = applyViewportCameraRules(beyond, 400, 240, beachStage());
    expect(resolveViewportCamera(bounded, 400, 240).x).toBe(400);
    expect(bounded.players.map((player) => player.screenEdge)).toEqual(['left', 'right']);

    const classicBounded = applyViewportCameraRules(beyond, 320, 240, beachStage());
    expect(resolveViewportCamera(classicBounded, 320, 240).x).toBe(480);
  });

  it('applies external Stage screen bounds to the player axis so sprites may protrude to the viewport edge', () => {
    const state = createInitialGameState(undefined, {}, [100, 400]);
    const next = applyViewportCameraRules(state, 400, 240, beachStage());
    const camera = resolveViewportCamera(next, 400, 240);

    expect(camera.x).toBe(160);
    expect(next.players[0].x).toBe(camera.x + 15);
    expect(next.players[0].x - 15).toBe(camera.x);
    expect(next.players[0].screenEdge).toBe('left');
    expect(next.players[1].screenEdge).toBeUndefined();
  });
});

function beachStage(): MugenStage {
  return {
    name: 'Beach in summer A',
    defPath: 'Beach_in_summerA.def',
    hiRes: true,
    zOffset: 220,
    camera: {
      startX: 0, startY: 0, boundLeft: -160, boundRight: 160,
      boundHigh: -110, boundLow: 10, verticalFollow: 0.9, floorTension: 100, tension: 50,
    },
    playerInfo: {
      p1StartX: -80, p1StartY: 0, p1Facing: 1,
      p2StartX: 80, p2StartY: 0, p2Facing: -1,
      leftBound: -1000, rightBound: 1000,
    },
    screenBound: { left: 15, right: 15 },
    sprites: { sprites: new Map() },
    layers: [],
  } as MugenStage;
}
