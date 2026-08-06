import type { GameState } from './types';
import { buildPushBox } from './FallbackStageRules';
import type { MugenStage } from '../stage/MugenStage';

export const MUGEN_WORLD_ORIGIN_X = 480;
export const MUGEN_GROUND_Y = 285;
const WINMUGEN_STAGE_VIEWPORT_WIDTH = 320;

export type ScreenSizeMode = 'winmugen-800x480' | 'winmugen-classic-640x480' | 'wide-960x540';

export type ScreenSizeProfile = {
  width: number;
  height: number;
  logicalWidth: number;
  logicalHeight: number;
  renderScale: number;
};

export const SCREEN_SIZE_PROFILES: Record<ScreenSizeMode, ScreenSizeProfile> = {
  'winmugen-800x480': { width: 800, height: 480, logicalWidth: 400, logicalHeight: 240, renderScale: 2 },
  'winmugen-classic-640x480': { width: 640, height: 480, logicalWidth: 320, logicalHeight: 240, renderScale: 2 },
  'wide-960x540': { width: 960, height: 540, logicalWidth: 960, logicalHeight: 540, renderScale: 1 },
};

export function getScreenSizeProfile(mode: ScreenSizeMode): ScreenSizeProfile {
  return SCREEN_SIZE_PROFILES[mode];
}

export function resolveCanvasViewport(width: number, height: number): Pick<ScreenSizeProfile, 'logicalWidth' | 'logicalHeight' | 'renderScale'> {
  if (width === 800 && height === 480) {
    return { logicalWidth: 400, logicalHeight: 240, renderScale: 2 };
  }
  if (width === 640 && height === 480) {
    return { logicalWidth: 320, logicalHeight: 240, renderScale: 2 };
  }
  return { logicalWidth: width, logicalHeight: height, renderScale: 1 };
}

export function resolveViewportCamera(state: GameState, width: number, height: number): { x: number; y: number } {
  if ((width !== 320 && width !== 400) || height !== 240) return { x: 0, y: 0 };
  if (state.camera?.viewportWidth === width && state.camera.viewportHeight === height) {
    return { x: state.camera.x, y: state.camera.y };
  }
  return resolveDesiredCamera(state, width, height);
}

export function applyViewportCameraRules(state: GameState, width: number, height: number, stage?: MugenStage | null): GameState {
  if ((width !== 320 && width !== 400) || height !== 240) {
    return { ...state, camera: { x: 0, y: 0, viewportWidth: width, viewportHeight: height } };
  }

  const leftInset = stage?.screenBound.left ?? 4;
  const rightInset = stage?.screenBound.right ?? 4;
  const desiredCamera = stage
    ? resolveStageCamera(state, width, height, stage)
    : resolveDesiredCamera(state, width, height);

  // Prefer moving the camera so every enabled root remains visible. Moving a
  // stationary opponent's world X merely to preserve the viewport makes it
  // look as though the retreating player drags the opponent across the stage.
  const camera = constrainCameraToPlayers(
    state,
    desiredCamera,
    width,
    leftInset,
    rightInset,
    stage ? resolveStageCameraXBounds(width, stage) : { minimum: 0, maximum: Math.max(0, 960 - width) },
  );

  // Only when the stage/camera bounds make it impossible to fit every player
  // do we clamp the root that is actually outside the final fixed viewport.
  const result = keepPlayersInsideCamera(state, camera.x, width, leftInset, rightInset);

  return {
    ...state,
    players: result.players,
    camera: { ...camera, viewportWidth: width, viewportHeight: height },
    hitDiagnosticLines: [
      ...(state.hitDiagnosticLines ?? []),
      `raw.camera viewport=${width}x${height} desired=(${formatNumber(desiredCamera.x)},${formatNumber(desiredCamera.y)}) pos=(${formatNumber(camera.x)},${formatNumber(camera.y)}) clamped=${result.clampedPlayers.length > 0 ? result.clampedPlayers.join(',') : 'none'}`,
    ],
  };
}

function resolveStageCamera(state: GameState, width: number, height: number, stage: MugenStage): { x: number; y: number } {
  const xFollowers = state.players.filter((player) => player.screenBound?.moveCameraX !== false);
  const yFollowers = state.players.filter((player) => player.screenBound?.moveCameraY !== false);
  const xSources = xFollowers.length > 0 ? xFollowers : state.players;
  const ySources = yFollowers.length > 0 ? yFollowers : state.players;
  const previousStageX = state.camera?.viewportWidth === width && state.camera.viewportHeight === height
    ? state.camera.x + width / 2 - MUGEN_WORLD_ORIGIN_X
    : stage.camera.startX;
  const minimumX = Math.min(...xSources.map((player) => player.x));
  const maximumX = Math.max(...xSources.map((player) => player.x));
  const tension = Math.max(0, Math.min(width / 2, stage.camera.tension));
  let stageX = previousStageX;
  let leftEdge = MUGEN_WORLD_ORIGIN_X + stageX - width / 2;
  if (minimumX < leftEdge + tension) stageX -= leftEdge + tension - minimumX;
  leftEdge = MUGEN_WORLD_ORIGIN_X + stageX - width / 2;
  if (maximumX > leftEdge + width - tension) stageX += maximumX - (leftEdge + width - tension);
  const stageCameraBounds = resolveStageCameraXBounds(width, stage);
  const cameraX = clamp(MUGEN_WORLD_ORIGIN_X + stageX - width / 2, stageCameraBounds.minimum, stageCameraBounds.maximum);

  const highestY = Math.min(...ySources.map((player) => player.y));
  const heightAboveFloor = Math.max(0, MUGEN_GROUND_Y - highestY);
  const desiredStageY = heightAboveFloor > stage.camera.floorTension
    ? stage.camera.startY - (heightAboveFloor - stage.camera.floorTension) * clamp(stage.camera.verticalFollow, 0, 1)
    : stage.camera.startY;
  const stageY = clamp(desiredStageY, stage.camera.boundHigh, stage.camera.boundLow);
  return {
    x: cameraX,
    y: MUGEN_GROUND_Y - stage.zOffset + stageY,
  };
}

function resolveStageCameraXBounds(width: number, stage: MugenStage): { minimum: number; maximum: number } {
  const horizontalViewportInset = Math.max(0, (width - WINMUGEN_STAGE_VIEWPORT_WIDTH) / 2);
  const adjustedBoundLeft = stage.camera.boundLeft + horizontalViewportInset;
  const adjustedBoundRight = stage.camera.boundRight - horizontalViewportInset;
  if (adjustedBoundLeft > adjustedBoundRight) {
    const centeredStageX = (stage.camera.boundLeft + stage.camera.boundRight) / 2;
    const centeredCameraX = MUGEN_WORLD_ORIGIN_X + centeredStageX - width / 2;
    return { minimum: centeredCameraX, maximum: centeredCameraX };
  }
  return {
    minimum: MUGEN_WORLD_ORIGIN_X + adjustedBoundLeft - width / 2,
    maximum: MUGEN_WORLD_ORIGIN_X + adjustedBoundRight - width / 2,
  };
}

function constrainCameraToPlayers(
  state: GameState,
  camera: { x: number; y: number },
  width: number,
  leftInset: number,
  rightInset: number,
  cameraBounds: { minimum: number; maximum: number },
): { x: number; y: number } {
  const visiblePlayers = state.players.filter((player) => player.screenBound?.value !== false);
  if (visiblePlayers.length === 0) return camera;

  const boxes = visiblePlayers.map(buildPushBox);
  const minimumPlayerLeft = Math.min(...boxes.map((box) => box.left));
  const maximumPlayerRight = Math.max(...boxes.map((box) => box.right));
  const minimumCameraForPlayers = maximumPlayerRight - (width - Math.max(0, rightInset));
  const maximumCameraForPlayers = minimumPlayerLeft - Math.max(0, leftInset);
  const allowedMinimum = Math.max(cameraBounds.minimum, minimumCameraForPlayers);
  const allowedMaximum = Math.min(cameraBounds.maximum, maximumCameraForPlayers);

  if (allowedMinimum <= allowedMaximum) {
    return { ...camera, x: clamp(camera.x, allowedMinimum, allowedMaximum) };
  }

  // The player span is wider than the usable viewport, or a stage bound makes
  // simultaneous containment impossible. Keep the legal camera position and
  // let the subsequent root-only clamp handle the actual offender.
  return { ...camera, x: clamp(camera.x, cameraBounds.minimum, cameraBounds.maximum) };
}

function resolveDesiredCamera(state: GameState, width: number, height: number): { x: number; y: number } {
  const xFollowers = state.players.filter((player) => player.screenBound?.moveCameraX !== false);
  const yFollowers = state.players.filter((player) => player.screenBound?.moveCameraY !== false);
  const xSources = xFollowers.length > 0 ? xFollowers : state.players;
  const center = xSources.reduce((sum, player) => sum + player.x, 0) / xSources.length;
  const highestY = Math.min(...(yFollowers.length > 0 ? yFollowers : state.players).map((player) => player.y));
  const lowestY = Math.max(...(yFollowers.length > 0 ? yFollowers : state.players).map((player) => player.y));
  const verticalRise = Math.max(0, 285 - highestY);
  const desiredY = 65 - verticalRise * 0.25;
  const minimumY = lowestY - (height - 8);
  const maximumY = highestY - 8;
  const y = minimumY <= maximumY
    ? Math.max(minimumY, Math.min(65, maximumY, desiredY))
    : (minimumY + maximumY) / 2;
  return {
    x: Math.max(0, Math.min(960 - width, center - width / 2)),
    y: Math.min(65, y),
  };
}

function keepPlayersInsideCamera(
  state: GameState,
  cameraX: number,
  width: number,
  leftInset: number,
  rightInset: number,
): { players: GameState['players']; clampedPlayers: string[] } {
  const leftEdge = cameraX + Math.max(0, leftInset);
  const rightEdge = cameraX + width - Math.max(0, rightInset);
  const clampedPlayers: string[] = [];
  const players = state.players.map((player) => {
    if (player.screenBound?.value === false) return player;
    const box = buildPushBox(player);
    let offsetX = 0;
    if (box.left < leftEdge) offsetX = leftEdge - box.left;
    if (box.right + offsetX > rightEdge) offsetX -= box.right + offsetX - rightEdge;
    if (offsetX === 0) return player;
    clampedPlayers.push(`p${player.id}`);
    return { ...player, x: player.x + offsetX };
  }) as GameState['players'];
  return { players, clampedPlayers };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(Math.min(minimum, maximum), Math.min(Math.max(minimum, maximum), value));
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
